"""
Oxy Engine Dependencies
========================
Shared authentication and dependency injection functions.

CRITICAL: This module breaks circular imports by providing auth dependencies
that can be imported by both main.py and routes/ without circular reference.

Dependencies extracted from main.py for modular architecture.
"""

import inspect
import json
import jwt
import hashlib
from decimal import Decimal
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypedDict
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Import shared resources
from core import resources, log, SUPABASE_URL, SUPABASE_KEY, KEY_PREFIX_LENGTH, KEY_CACHE_TTL
from security_utils import SecretString, log_error_safe

# ============================================================================
# AUTHENTICATION SCHEME
# ============================================================================

auth_scheme = HTTPBearer()

# JWT validation constants
JWT_EXPIRY_TOLERANCE_SECONDS = 60  # Clock skew tolerance

# ============================================================================
# TYPE DEFINITIONS
# ============================================================================

class CacheData(TypedDict):
    """
    Cached API key data structure.
    
    ARCHITECTURE NOTE:
    - api_key: The Oxy API key (oxy-xxxx) that was used to authenticate
    - Provider keys (OpenAI, Anthropic) are fetched separately from 'providers' table
    
    SECURITY: api_key is wrapped in SecretString to prevent accidental logging.
    MULTI-TENANCY: organization_id is required for audit logs and RLS.
    """
    user_id: str
    project_id: str
    organization_id: str
    api_key: SecretString  # The Oxy API key used for this request
    key_id: str
    budget_limit: Decimal
    created_by: str  # User who created this API key (for audit)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_supabase_headers(prefer: str | None = None, service_role: bool = True, user_token: str | None = None) -> dict:
    """
    Get headers for Supabase API requests.
    
    Args:
        prefer: Optional Prefer header value (e.g., "count=exact", "return=minimal")
        service_role: If True (default), uses SERVICE_ROLE key to bypass RLS.
                      This is CRITICAL for admin operations and internal checks.
        user_token: Optional user JWT token. If provided, uses authenticated role instead of service_role.
                    SECURITY: Prefer user_token for SECURITY DEFINER functions with GRANT EXECUTE.
    
    SECURITY:
        - service_role=True + user_token=None: Bypasses RLS, full database access (admin operations)
        - service_role=False + user_token=JWT: Uses authenticated role (SECURITY DEFINER functions)
        - service_role=True + user_token=JWT: IGNORED (service_role takes precedence)
    
    Returns:
        dict: Headers for Supabase REST API requests
    
    BEST PRACTICE:
        - For RPC functions with SECURITY DEFINER + GRANT EXECUTE TO authenticated:
          Use user_token (principle of least privilege)
        - For internal admin queries that bypass RLS:
          Use service_role=True (default)
    """
    # SECURITY FIX: If user_token provided and service_role=False, use authenticated role
    if user_token and not service_role:
        headers = {
            "apikey": SUPABASE_KEY,  # Still need anon/service key for apikey header
            "Authorization": f"Bearer {user_token}",  # User's JWT for authenticated role
            "Content-Type": "application/json"
        }
    else:
        # Default: Service role (bypasses RLS)
        headers = {
            "apikey": SUPABASE_KEY,  # SUPABASE_KEY = SUPABASE_SERVICE_KEY (bypasses RLS)
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
    
    if prefer:
        headers["Prefer"] = prefer
    return headers


def hash_key(key: str) -> str:
    """Hash API key for database storage (SHA-256)."""
    return hashlib.sha256(key.encode()).hexdigest()


def api_key_cache_name_for_hash(key_hash: str) -> str:
    """Redis name of the cached record for the API key with this SHA-256."""
    return f"api_key:{key_hash}"


def api_key_cache_name(api_key: str) -> str:
    """Redis name of the cached record for an Oxy API key.

    Built from the key's SHA-256 (the same value as api_keys.key_hash), never from
    the key itself: anyone who can list Redis keys (KEYS, SCAN, MONITOR, a dump, a
    replica) must not learn a tenant's key. The `project_keys:{project}` sets hold
    the same hashes, and the cache-clearing Lua script joins them to `api_key:`.
    Because the database row carries key_hash, revoking a key can drop its cached
    record directly.
    """
    return api_key_cache_name_for_hash(hash_key(api_key))


def project_keys_set_name(project_id: str) -> str:
    """Redis set of the key hashes cached for a project (cleared on budget changes)."""
    return f"project_keys:{project_id}"


async def forget_cached_api_key(key_hash: str | None, project_id: str | None = None) -> None:
    """Drop a key's cached record at once, so a revoked key stops working now.

    Raises when Redis cannot answer: the caller must report that, because a
    record left in the cache keeps the key working until it expires.
    """
    if resources.redis is None:
        return  # no Redis configured (offline tests): nothing is cached
    if not key_hash:
        raise ValueError("the api_keys row carried no key_hash")
    async with resources.redis.pipeline(transaction=True) as pipe:
        pipe.delete(api_key_cache_name_for_hash(key_hash))
        if project_id:
            pipe.srem(project_keys_set_name(project_id), key_hash)
        await pipe.execute()


def api_key_lock_name(api_key: str) -> str:
    """Redis name of the lock that fills the cache for one API key (hashed, as above)."""
    return f"lock:api_key:{hash_key(api_key)}"


def build_api_key_dependency(resolver_getter: Callable[[], Callable[..., Awaitable[CacheData] | CacheData]]):
    """
    Create a dependency that defers resolver lookup to call-time.
    
    Tests monkeypatch route modules by reassigning get_user_and_key_from_api_key;
    this wrapper ensures those overrides are respected without rebuilding routers.
    """
    optional_scheme = HTTPBearer(auto_error=False)

    async def _dependency(
        creds: HTTPAuthorizationCredentials | None = Depends(optional_scheme),
    ) -> CacheData:
        resolver = resolver_getter()
        try:
            if creds is not None:
                result = resolver(creds)  # type: ignore[arg-type]
            else:
                # Allow parameterless test stubs when Authorization header is absent
                result = resolver()  # type: ignore[call-arg]
        except TypeError:
            # Resolver signature mismatch; fall back to no-arg
            result = resolver()  # type: ignore[call-arg]
        except HTTPException:
            raise
        except Exception:
            # Missing/invalid auth in real runs should surface as 401
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

        if inspect.isawaitable(result):
            return await result  # type: ignore[return-value]
        return result  # type: ignore[return-value]

    return _dependency


# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

async def get_user_and_key_from_api_key(
    creds: HTTPAuthorizationCredentials = Depends(auth_scheme)
) -> CacheData:
    """
    Authenticate API key and return cached user/project data.
    
    REDIS FAILOVER: If Redis is down, falls back to Supabase (slower but reliable).
    
    SECURITY:
    - API keys are cached in Redis (encrypted)
    - Plaintext keys are wrapped in SecretString to prevent logging
    - Hash-based lookup prevents rainbow table attacks
    
    PERFORMANCE:
    - Redis hit: ~2ms response time
    - Database fallback: ~50ms response time
    - Cache TTL: 24 hours
    
    Args:
        creds: HTTP Bearer credentials from Authorization header
        
    Returns:
        CacheData with user_id, project_id, organization_id, api_key, key_id, budget_limit, created_by
        
    Raises:
        HTTPException 401: Invalid API key format or not found
    """
    api_key = creds.credentials
    if not api_key.startswith("oxy_live_") or len(api_key) < KEY_PREFIX_LENGTH:
        raise HTTPException(status_code=401, detail="Invalid API key format")
    key_name = api_key_cache_name(api_key)

    try:
        # Fast path: the cached record.
        try:
            cached = await _read_cached_key(key_name)
        except Exception as e:
            # Redis down or slow (the client has timeouts): the database answers, uncached.
            log.warning("redis_failover_activated",
                        reason="Redis unavailable, using database fallback",
                        error=str(e)[:200])
            return await _fetch_and_cache_api_key(api_key, key_name, cache=False)
        if cached:
            return cached

        # Cache miss: one request fills the cache, the others wait briefly for it.
        try:
            lock = resources.redis.lock(api_key_lock_name(api_key), timeout=10, sleep=0.02, blocking_timeout=2)
            acquired = await lock.acquire()
        except Exception as e:
            log.warning("redis_failover_activated", reason="Redis lock unavailable", error=str(e)[:200])
            return await _fetch_and_cache_api_key(api_key, key_name, cache=False)
        if not acquired:
            # Many first requests with the same key at once: another one holds the
            # lock and is filling the cache. Read it, or go to the database uncached,
            # instead of failing the request.
            try:
                cached = await _read_cached_key(key_name)
            except Exception:
                cached = None
            return cached or await _fetch_and_cache_api_key(api_key, key_name, cache=False)
        try:
            cached = await _read_cached_key(key_name)  # filled while we waited?
            if cached:
                return cached
            return await _fetch_and_cache_api_key(api_key, key_name)
        finally:
            try:
                await lock.release()
            except Exception:
                pass

    except HTTPException:
        raise  # 401 for an unknown key stays 401
    except Exception as e:
        log_error_safe(log, "api_key_validation_error", e)
        raise HTTPException(status_code=500, detail="Internal server error during authentication")


async def _read_cached_key(key_name: str) -> CacheData | None:
    """The cached record for a key, or None. Raises when Redis cannot answer."""
    cached_data = await resources.redis.get(key_name)
    if not cached_data:
        return None
    data = json.loads(cached_data)
    encrypted_key = data.get('api_key')
    if encrypted_key:
        # The key itself is stored encrypted inside the record.
        data['api_key'] = SecretString(resources.cache_encryption.decrypt(encrypted_key))
    data['budget_limit'] = Decimal(data.get('budget_limit', '0.0'))
    data['organization_id'] = data.get('organization_id', '')
    data['created_by'] = data.get('created_by', '')
    return data


async def _fetch_and_cache_api_key(api_key: str, cache_key: str, cache: bool = True) -> CacheData:
    """
    Fetch API key from database and optionally cache in Redis.
    
    SECURITY: 
    - Uses hash-based lookup to prevent rainbow table attacks.
    - Uses SECURITY DEFINER RPC function to bypass RLS safely.
    - This allows API key validation even for unauthenticated requests.
    """
    key_hash = hash_key(api_key)
    
    try:
        # Use RPC to bypass RLS safely (SECURITY DEFINER function)
        # This is necessary because API key validation happens BEFORE auth
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_validate_api_key",
            json={"p_key_hash": key_hash},
            headers=get_supabase_headers(),
            timeout=10.0
        )
        res.raise_for_status()
        
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        row = rows[0]
        
        # Construct cache data from RPC response (flat structure)
        # RPC returns: api_key_id, project_id, user_id, organization_id, budget_limit
        # The api_key field stores the ORIGINAL Oxy key that was passed in
        # This is needed for logging and audit purposes
        data: CacheData = {
            'user_id': row['user_id'],  # user_id from RPC (was created_by)
            'project_id': row['project_id'],
            'organization_id': row.get('organization_id', ''),
            'api_key': SecretString(api_key),  # Store the original Oxy key
            'key_id': row['api_key_id'],  # api_key_id from RPC (was id)
            'budget_limit': Decimal(str(row.get('budget_limit', 0.0))),
            'created_by': row['user_id']  # Same as user_id
        }
        
        # Cache in Redis (if available)
        if cache:
            try:
                # Encrypt api_key before caching
                encrypted_for_cache = resources.cache_encryption.encrypt(api_key)
                cache_data = {
                    'user_id': data['user_id'],
                    'project_id': data['project_id'],
                    'organization_id': data['organization_id'],
                    'api_key': encrypted_for_cache,
                    'key_id': data['key_id'],
                    'budget_limit': str(data['budget_limit']),
                    'created_by': data['created_by']
                }
                async with resources.redis.pipeline(transaction=True) as pipe:
                    pipe.set(cache_key, json.dumps(cache_data), ex=KEY_CACHE_TTL)
                    # Every cached key is listed under its project, so a budget change
                    # (clear_project_cache) reaches keys made at onboarding or through
                    # /v1/api-keys too, not only those made by /management/keys.
                    pipe.sadd(project_keys_set_name(data['project_id']), key_hash)
                    await pipe.execute()
            except Exception as e:
                log.warning("api_key_cache_write_failed", error=str(e))
        
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        log_error_safe(log, "api_key_fetch_failed", e)
        raise HTTPException(status_code=500, detail="Failed to validate API key")


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(auth_scheme)
) -> dict:
    """
    Validate JWT token and return full user object.
    
    CRITICAL: Defense-in-depth JWT validation:
    1. Local expiry check (clock skew tolerance)
    2. Issued-at check (prevent future-dated tokens)
    3. Authoritative Supabase Auth verification
    
    SECURITY:
    - Clock skew tolerance: 60 seconds
    - Prevents replay attacks via 'iat' validation
    - Authoritative check with Supabase (can't be bypassed)
    
    Args:
        creds: HTTP Bearer credentials (JWT token)
        
    Returns:
        user: Full user object from Supabase Auth with fields:
            - id: User UUID
            - email: User email
            - user_metadata: Custom metadata
            - app_metadata: App metadata (may contain organization_id)
            - created_at, updated_at, etc.
        
    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 503: Authentication service unavailable
    """
    token = creds.credentials
    
    # STEP 1: Local JWT validation (defense in depth)
    try:
        # Decode without verification first to check expiry
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        # Check expiry
        exp = unverified_payload.get('exp')
        if not exp:
            log.warn("jwt_missing_exp", reason="JWT missing exp claim")
            raise HTTPException(status_code=401, detail="Invalid token: missing expiry")
        
        now = datetime.now(timezone.utc).timestamp()
        if now > exp + JWT_EXPIRY_TOLERANCE_SECONDS:
            log.warn("jwt_expired", exp=exp, now=now)
            raise HTTPException(status_code=401, detail="Token expired")
        
        # Check issued at (prevent old tokens / clock skew attacks)
        iat = unverified_payload.get('iat')
        if iat and now < iat - JWT_EXPIRY_TOLERANCE_SECONDS:
            log.warn("jwt_issued_future", 
                    iat=iat, 
                    now=now, 
                    reason="Token issued in future (clock skew attack)")
            raise HTTPException(status_code=401, detail="Invalid token: time anomaly")
        
    except jwt.DecodeError:
        log.warn("jwt_decode_failed", reason="Malformed JWT")
        raise HTTPException(status_code=401, detail="Invalid token format")
    except HTTPException:
        raise
    except Exception as e:
        log_error_safe(log, "jwt_validation_error", e)
        raise HTTPException(status_code=401, detail="Token validation failed")
    
    # STEP 2: Verify with Supabase Auth (authoritative check)
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY},
            timeout=5.0
        )
        res.raise_for_status()
        user = res.json()
        if not user or not user.get('id'):
            raise Exception("Invalid JWT payload")
        return user
    except Exception as e:
        if hasattr(e, '__class__') and 'TimeoutException' in e.__class__.__name__:
            log.error("supabase_auth_timeout", reason="Supabase Auth service timeout")
            raise HTTPException(status_code=503, detail="Authentication service unavailable")
        log.warn("auth_failed", reason="Invalid management session JWT")
        raise HTTPException(status_code=401, detail="Invalid management session")


async def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(auth_scheme)
) -> str:
    """
    Validate JWT token and return user ID (convenience wrapper).
    
    This is a lightweight wrapper around get_current_user() that extracts
    just the user ID. Use this when you only need the ID string.
    
    For full user object (with metadata, email, etc), use get_current_user().
    
    Args:
        creds: HTTP Bearer credentials (JWT token)
        
    Returns:
        user_id: Authenticated user ID from Supabase
        
    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 503: Authentication service unavailable
    """
    user = await get_current_user(creds)
    return user['id']

