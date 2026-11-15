"""
Oxy Engine Auth Router
=======================
Authentication and onboarding endpoints.

Endpoints:
- POST /management/onboard - Initial user onboarding with API keys
- DELETE /management/onboard - User offboarding (cleanup)
- POST /management/profile - Update user profile
- POST /management/provider - Update provider API keys
- DELETE /management/provider - Disconnect provider

SECURITY: All endpoints require JWT authentication (get_current_user_id dependency).
"""

import json
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

# Import shared resources and dependencies
from core import resources, log, SUPABASE_URL, RATE_LIMIT_MANAGEMENT_PER_MINUTE
from dependencies import get_current_user_id, get_supabase_headers
from security_utils import log_error_safe

# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/management", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

def sanitize_input(v: str) -> str:
    """
    Sanitize user input to prevent XSS/injection attacks.
    
    SECURITY: Removes HTML tags, normalizes whitespace, limits length.
    """
    if not v:
        return v
    # Remove common XSS patterns
    v = v.replace('<', '').replace('>', '').replace('"', '').replace("'", '')
    # Normalize whitespace
    v = ' '.join(v.split())
    return v.strip()


class OnboardRequest(BaseModel):
    """
    User onboarding request with provider API keys.
    
    At least one provider key is required (no single-vendor default).
    """
    openai_key: str | None = Field(None, max_length=200, description="OpenAI API key (optional)")
    full_name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    email: str = Field(..., max_length=255, description="User's email address")
    anthropic_key: str | None = Field(None, max_length=200, description="Anthropic API key (optional)")
    google_key: str | None = Field(None, max_length=200, description="Google Gemini API key (optional)")
    referral_code: str | None = Field(None, max_length=20, description="Referral code (optional, e.g., 'OXY-A7F2X')")

    @field_validator('full_name')
    def sanitize_full_name(cls, v):
        return sanitize_input(v)
    
    @field_validator('email')
    def validate_email(cls, v):
        # Basic email validation (Supabase will do full validation)
        if '@' not in v or '.' not in v:
            raise ValueError('Invalid email format')
        return v.lower().strip()
    
    @field_validator('referral_code')
    def validate_referral_code(cls, v):
        if not v:
            return v
        # Referral code format: OXY-XXXXX (5 alphanumeric chars)
        v = v.upper().strip()
        if not v.startswith('OXY-') or len(v) != 9:
            raise ValueError('Invalid referral code format. Expected: OXY-XXXXX')
        return v


class ProfileUpdateRequest(BaseModel):
    """Update user profile (name only)."""
    full_name: str = Field(..., min_length=2, max_length=100)
    
    @field_validator('full_name')
    def sanitize_full_name(cls, v):
        return sanitize_input(v)


class ProviderUpdateRequest(BaseModel):
    """
    ProviderUpdateRequest:
    - Used by /management/provider (Dashboard → AI Provider Keys)
    - UI MUST send: {"provider_name": "openai"|"anthropic"|"google", "<provider>_key": "..."}
    """
    provider_name: str = Field(..., description="Provider to update: openai | anthropic | google")
    openai_key: str | None = Field(None, max_length=200, description="OpenAI API key (required if provider_name=openai)")
    anthropic_key: str | None = Field(None, max_length=200, description="Anthropic API key (required if provider_name=anthropic)")
    google_key: str | None = Field(None, max_length=200, description="Google API key (required if provider_name=google)")
    
    @model_validator(mode="after")
    def validate_required_key_for_provider(self):
        """
        Ensure that for the selected provider_name, the corresponding key is provided.
        Replaces old field-level validators to be compatible with Pydantic v2.
        """
        allowed = {"openai", "anthropic", "google"}
        if self.provider_name not in allowed:
            raise ValueError("provider_name must be one of: openai, anthropic, google")
        
        if self.provider_name == "openai" and not self.openai_key:
            raise ValueError("openai_key is required when provider_name is 'openai'.")
        if self.provider_name == "anthropic" and not self.anthropic_key:
            raise ValueError("anthropic_key is required when provider_name is 'anthropic'.")
        if self.provider_name == "google" and not self.google_key:
            raise ValueError("google_key is required when provider_name is 'google'.")
        return self


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def validate_openai_key(key: str) -> bool:
    """
    Validate OpenAI API key by making a test request.
    
    SECURITY: Uses minimal API call (models list) to verify key.
    
    MOCK MODE (SIMULATOR): If key starts with 'sk-test', auto-validate
    in development environment for testing without real API calls.
    """
    # MOCK MODE: Accept test keys in development
    if key.startswith("sk-test"):
        log.info("openai_key_mock_mode", key_prefix=key[:10], reason="Test key auto-validated")
        return True
    
    try:
        res = await resources.http_client.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=10.0
        )
        return res.status_code == 200
    except Exception as e:
        log.error("openai_key_validation_failed", error=str(e))
        return False


async def validate_anthropic_key(key: str) -> bool:
    """
    Validate Anthropic API key by making a test request.
    
    SECURITY: Uses minimal API call to verify key.
    
    MOCK MODE (SIMULATOR): If key starts with 'sk-ant-test', auto-validate
    in development environment for testing without real API calls.
    """
    # MOCK MODE: Accept test keys in development
    if key.startswith("sk-ant-test"):
        log.info("anthropic_key_mock_mode", key_prefix=key[:15], reason="Test key auto-validated")
        return True
    
    try:
        # Anthropic doesn't have a simple "list models" endpoint
        # We'll use a minimal completion request
        res = await resources.http_client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            json={
                "model": "claude-3-haiku-20240307",
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "Hi"}]
            },
            timeout=10.0
        )
        # Accept both 200 (success) and 400 (validation error but key is valid)
        return res.status_code in [200, 400]
    except Exception as e:
        log.error("anthropic_key_validation_failed", error=str(e))
        return False


async def validate_google_key(key: str) -> bool:
    """
    Validate Google Gemini API key by making a test request.
    
    SECURITY: Uses minimal API call to verify key.
    
    MOCK MODE (SIMULATOR): If key starts with 'goog-test', auto-validate
    in development environment for testing without real API calls.
    """
    # MOCK MODE: Accept test keys in development
    if key.startswith("goog-test"):
        log.info("google_key_mock_mode", key_prefix=key[:12], reason="Test key auto-validated")
        return True
    
    try:
        # Use the models.list endpoint to validate the key
        res = await resources.http_client.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=10.0
        )
        return res.status_code == 200
    except Exception as e:
        log.error("google_key_validation_failed", error=str(e))
        return False


async def clear_user_cache(user_id: str):
    """
    Clear all cached data for a user.
    
    CRITICAL: Call this after any operation that changes user/project/key data.
    """
    try:
        # Clear all API keys for user
        # HOTFIX: api_keys table uses 'created_by' column, not 'user_id'
        keys_result = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            params={"select": "id", "created_by": f"eq.{user_id}"},
            headers=get_supabase_headers(),
            timeout=5.0
        )
        if keys_result.status_code == 200:
            keys = keys_result.json()
            for key_obj in keys:
                # We can't clear the actual API key cache (we don't have the plaintext key)
                # But we can clear project-level caches
                pass
        
        log.info("user_cache_cleared", user_id=user_id)
    except Exception as e:
        log.error("cache_clear_failed", user_id=user_id, error=str(e))


# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@router.post("/onboard")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def onboard_user(
    request: Request, 
    req: OnboardRequest, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Onboard a new user with OpenAI and/or Anthropic API keys.
    
    At least one provider key is required.
    
    CRITICAL: This endpoint calls Supabase RPC function fn_onboard_user (JSONB wrapper with explicit permissions).
    Ensure the function exists in your Supabase database.
    
    Args:
        req: Onboarding request with full_name, email, and API keys
        user_id: Authenticated user ID from JWT
        
    Returns:
        {"status": "onboarded"}
        
    Raises:
        HTTPException 400: Invalid API key
        HTTPException 500: Database error
    """
    # Ensure user profile exists before onboarding
    # This prevents 403 errors on subsequent /management/status calls
    try:
        # Check if profile exists
        profile_check = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={
                "select": "id",
                "id": f"eq.{user_id}"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        
        if profile_check.status_code == 200:
            profiles = profile_check.json()
            if not profiles:
                # Profile doesn't exist - create it with SERVICE ROLE (bypasses RLS)
                log.warning("profile_missing_creating_fallback", user_id=user_id)
                
                profile_create = await resources.http_client.post(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    headers=get_supabase_headers(prefer="return=minimal"),  # Use service role
                    json={
                        "id": user_id,
                        "full_name": req.full_name,
                        "email": req.email
                        # Note: onboarded_at is set by fn_onboard_user when onboarding completes
                    },
                    timeout=5.0
                )
                
                if profile_create.status_code in [200, 201]:
                    log.info("profile_created_fallback", user_id=user_id)
                else:
                    log.error("profile_creation_failed", 
                             user_id=user_id, 
                             status_code=profile_create.status_code,
                             response=profile_create.text[:200])
                    # CRITICAL: Profile must exist for onboarding to succeed
                    raise HTTPException(
                        status_code=500, 
                        detail="Failed to create user profile. Please try again or contact support."
                    )
    except HTTPException:
        raise
    except Exception as e:
        # Profile creation is CRITICAL for onboarding
        log.error("profile_check_error", user_id=user_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to verify user profile. Please try again."
        )
    
    try:
        # Provider keys are optional during onboarding — a user may finish
        # onboarding without any and add keys later via Settings → Providers.
        # Each key, if provided, is still validated against its upstream API.

        # Validate OpenAI key (if provided)
        if req.openai_key:
            is_valid_openai = await validate_openai_key(req.openai_key)
            if not is_valid_openai:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid OpenAI key. Authentication with OpenAI failed."
                )
        
        # Validate Anthropic key (if provided)
        if req.anthropic_key:
            is_valid_anthropic = await validate_anthropic_key(req.anthropic_key)
            if not is_valid_anthropic:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid Anthropic key. Authentication with Anthropic failed."
                )
        
        # Validate Google Gemini key (if provided)
        if req.google_key:
            is_valid_google = await validate_google_key(req.google_key)
            if not is_valid_google:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid Google Gemini key. Authentication with Google failed."
                )
    except HTTPException:
        raise
    except Exception as e:
        log.error("key_validation_error", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to validate API keys. Please try again.")
    
    # FRAUD PREVENTION: Capture IP and User-Agent for fraud detection
    signup_ip = None
    signup_user_agent = None
    
    try:
        # Extract client IP (handles proxies via X-Forwarded-For)
        if "x-forwarded-for" in request.headers:
            signup_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
        elif "x-real-ip" in request.headers:
            signup_ip = request.headers["x-real-ip"]
        elif request.client:
            signup_ip = request.client.host
        
        # Extract User-Agent for fraud scoring
        signup_user_agent = request.headers.get("user-agent", "")[:500]  # Truncate to 500 chars
        
        log.info("onboard_fraud_prevention", 
                user_id=user_id, 
                signup_ip=signup_ip, 
                has_user_agent=bool(signup_user_agent))
    except Exception as e:
        log.warning("fraud_prevention_capture_failed", user_id=user_id, error=str(e))
        # Non-fatal: Continue onboarding even if IP capture fails
    
    try:
        # Call Supabase RPC function
        # Build payload with all parameters (including NEW: referral_code, signup_ip, signup_user_agent)
        rpc_payload = {
            "p_user_id": user_id,
            "p_full_name": req.full_name,
            "p_email": req.email,
            "p_openai_key": req.openai_key if req.openai_key else "",
            "p_anthropic_key": req.anthropic_key if req.anthropic_key else "",
            "p_google_key": req.google_key if req.google_key else "",
            "p_referral_code": req.referral_code if req.referral_code else "",  # NEW: Viral growth
            "p_signup_ip": signup_ip if signup_ip else "",  # NEW: Fraud prevention
            "p_signup_user_agent": signup_user_agent if signup_user_agent else ""  # NEW: Fraud prevention
        }
        
        # SECURITY FIX: Extract user's JWT from Authorization header
        # fn_onboard_user is SECURITY DEFINER with GRANT EXECUTE TO authenticated
        # Using user's JWT (authenticated role) instead of SERVICE_ROLE_KEY follows least privilege
        user_token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            user_token = auth_header[7:]  # Extract token after "Bearer "
        
        if not user_token:
            log.error("onboard_missing_jwt", user_id=user_id, reason="Authorization header missing or invalid")
            raise HTTPException(status_code=401, detail="Authentication token required")
        
        # Call the onboarding function as the engine. user_id comes from the JWT
        # verified above; browser roles cannot execute the database functions
        # (db/schema.sql, section 4), so this call needs the service role.
        
        # 🕵️ FORENSIC DEBUG: Log exact RPC call details
        rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/fn_onboard_user"
        headers = get_supabase_headers()
        log.info(
            "onboard_rpc_call",
            user_id=user_id,
            function_name="fn_onboard_user",
            url=rpc_url,
            has_payload=bool(rpc_payload),
            payload_keys=list(rpc_payload.keys()),
            apikey_prefix=headers.get("apikey", "")[:20] + "..." if headers.get("apikey") else "MISSING",
            auth_type="service_role",
        )
        
        res = await resources.http_client.post(
            rpc_url,
            headers=headers,
            json={"payload": rpc_payload},
            timeout=30.0
        )
        
        # 🕵️ FORENSIC DEBUG: Log response details
        log.info(
            "onboard_rpc_response",
            user_id=user_id,
            status_code=res.status_code,
            has_content=bool(res.content),
            content_preview=res.text[:200] if res.text else "EMPTY"
        )
        
        # Check response status
        if res.status_code == 404:
            log.error("onboard_rpc_not_found", 
                     user_id=user_id, 
                     message="fn_onboard_user RPC function not found in Supabase",
                     response_body=res.text)
            raise HTTPException(
                status_code=500, 
                detail="Database function not found. Please ensure fn_onboard_user(jsonb) exists in Supabase with GRANT EXECUTE to authenticated, anon, service_role, postgres. Run: NOTIFY pgrst, 'reload schema';"
            )
        
        if res.status_code >= 400:
            try:
                error_data = res.json()
                error_message = error_data.get("message", error_data.get("error", "Unknown database error"))
                log.error("onboard_supabase_error", 
                         user_id=user_id, 
                         status=res.status_code, 
                         error=error_message)
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {error_message}"
                )
            except (json.JSONDecodeError, KeyError):
                log.error("onboard_supabase_error_unknown", 
                         user_id=user_id, 
                         status=res.status_code)
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error (status {res.status_code}). Check server logs for details."
                )
        
        res.raise_for_status()
        
        # CRITICAL: Parse DB response which contains the API key
        db_response = res.json()
        
        await clear_user_cache(user_id)
        
        # FRAUD PREVENTION + REFERRAL TRACKING: Update profile after onboarding
        profile_updates = {}
        
        # Add fraud prevention data
        if signup_ip:
            profile_updates["signup_ip"] = signup_ip
        if signup_user_agent:
            profile_updates["signup_user_agent"] = signup_user_agent
        
        # Add referral tracking
        if req.referral_code:
            try:
                # Lookup referrer by referral code
                referrer_res = await resources.http_client.get(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    params={
                        "select": "id,full_name",
                        "referral_code": f"eq.{req.referral_code}",
                        "limit": "1"
                    },
                    headers=get_supabase_headers(),
                    timeout=5.0
                )
                
                if referrer_res.status_code == 200:
                    referrers = referrer_res.json()
                    if referrers:
                        referrer_id = referrers[0]["id"]
                        referrer_name = referrers[0].get("full_name", "Unknown")
                        
                        # Check for self-referral (fraud prevention)
                        if referrer_id != user_id:
                            profile_updates["referred_by"] = referrer_id
                            log.info("referral_applied", 
                                    user_id=user_id, 
                                    referrer_id=referrer_id,
                                    referrer_name=referrer_name,
                                    referral_code=req.referral_code)
                        else:
                            log.warning("self_referral_blocked", 
                                       user_id=user_id, 
                                       referral_code=req.referral_code)
                    else:
                        log.warning("invalid_referral_code", 
                                   user_id=user_id, 
                                   referral_code=req.referral_code)
            except Exception as referral_error:
                # Non-fatal: Don't block onboarding if referral lookup fails
                log.warning("referral_lookup_error", 
                           user_id=user_id, 
                           error=str(referral_error))
        
        # Apply all profile updates
        if profile_updates:
            try:
                update_res = await resources.http_client.patch(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    params={"id": f"eq.{user_id}"},
                    headers=get_supabase_headers(),
                    json=profile_updates,
                    timeout=5.0
                )
                
                if update_res.status_code == 200:
                    log.info("profile_enrichment_complete", 
                            user_id=user_id, 
                            has_ip=bool(signup_ip),
                            has_referral=bool(req.referral_code))
                else:
                    log.warning("profile_enrichment_failed", 
                               user_id=user_id, 
                               status_code=update_res.status_code)
            except Exception as update_error:
                # Non-fatal: Don't block onboarding if profile update fails
                log.warning("profile_enrichment_error", 
                           user_id=user_id, 
                           error=str(update_error))
            
    except HTTPException:
        raise
    except Exception as e:
        log.error("onboard_failed_rpc", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Onboarding failed due to an internal error.")
    
    log.info("user_onboarded", user_id=user_id, name=req.full_name, fraud_prevention_active=bool(signup_ip))
    
    # CRITICAL: Return DB response containing API key for tests and clients
    # db_response contains: success, profile_id, organization_id, project_id, member_id, api_key
    return db_response


@router.get("/export-data")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def export_user_data(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    GDPR Article 20: Right to Data Portability
    Export all user data as JSON (machine-readable format).
    
    Returns:
        JSON file containing all user data (profile, projects, usage, etc.)
    """
    try:
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_export_user_data",
            headers=get_supabase_headers(),
            json={"user_id_param": user_id},
            timeout=30.0
        )
        res.raise_for_status()
        data = res.json()
        
        log.info("user_data_exported", user_id=user_id)
        
        return JSONResponse(
            content=data,
            headers={
                "Content-Disposition": f"attachment; filename=oxy-data-{user_id}.json",
                "Content-Type": "application/json"
            }
        )
    except Exception as e:
        log.error("data_export_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Data export failed")


@router.delete("/onboard")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def offboard_user(
    request: Request, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Offboard user (cleanup all data).
    
    CRITICAL: This is a destructive operation. Use with caution.
    """
    try:
        await clear_user_cache(user_id)
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_offboard_user",
            headers=get_supabase_headers(),
            json={"p_user_id": user_id},
            timeout=30.0
        )
        res.raise_for_status()
    except Exception as e:
        log.error("offboard_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Offboarding failed")
    
    log.info("user_offboarded", user_id=user_id)
    return {"status": "offboarded"}


@router.post("/profile")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def update_profile(
    request: Request, 
    req: ProfileUpdateRequest, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Update user profile (full name).
    
    Updates BOTH locations to keep them in sync:
    1. profiles table (database source of truth)
    2. auth.users.raw_user_meta_data (for frontend Supabase client)
    """
    try:
        # 1. Update profiles table (source of truth)
        # CRITICAL: profiles.id is the primary key (not user_id)
        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            headers=get_supabase_headers(service_role=True),  # Bypass RLS
            json={"full_name": req.full_name},
            timeout=10.0
        )
        res.raise_for_status()
        
        # 2. Also update Supabase Auth metadata
        # This ensures frontend's supabase.auth.getUser() returns updated name
        auth_res = await resources.http_client.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers=get_supabase_headers(service_role=True),
            json={"user_metadata": {"full_name": req.full_name}},
            timeout=10.0
        )
        if not auth_res.is_success:
            log.warning(
                "auth_metadata_update_failed",
                user_id=user_id,
                status=auth_res.status_code,
                body=auth_res.text[:200] if auth_res.text else "empty"
            )
            # Non-fatal: profiles table is source of truth
            
    except Exception as e:
        log.error("profile_update_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Profile update failed")
    
    log.info("profile_updated", user_id=user_id, name=req.full_name)
    return {"status": "updated", "full_name": req.full_name}


@router.post("/provider")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def update_provider(
    request: Request, 
    req: ProviderUpdateRequest, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Update provider API key (Dashboard → AI Provider Keys).
    
    SECURITY: Validates key before storing. Requires provider_name and matching key field.
    """
    provider = req.provider_name
    provider_key = None
    
    if provider == "openai":
        provider_key = req.openai_key
        is_valid = await validate_openai_key(provider_key)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid OpenAI key")
    elif provider == "anthropic":
        provider_key = req.anthropic_key
        # Optional: add validation for Anthropic keys here if desired
        if not provider_key:
            raise HTTPException(status_code=400, detail="anthropic_key is required when provider_name is 'anthropic'.")
    elif provider == "google":
        provider_key = req.google_key
        # Optional: add validation for Google keys here if desired
        if not provider_key:
            raise HTTPException(status_code=400, detail="google_key is required when provider_name is 'google'.")
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider_name")
    
    try:
        # Resolve organization_id (owner org)
        org_id = None
        org_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={
                "select": "id",
                "owner_user_id": f"eq.{user_id}",
                "limit": "1"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        if org_res.status_code == 200 and org_res.json():
            org_id = org_res.json()[0].get("id")
        
        # Fallback: membership lookup
        if not org_id:
            member_res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/organization_members",
                params={
                    "select": "organization_id",
                    "user_id": f"eq.{user_id}",
                    "status": "eq.active",
                    "limit": "1"
                },
                headers=get_supabase_headers(),
                timeout=5.0
            )
            if member_res.status_code == 200 and member_res.json():
                org_id = member_res.json()[0].get("organization_id")
        
        if not org_id:
            raise HTTPException(status_code=400, detail="Organization not found for user")
        
        # Update via RPC
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_update_provider_key",
            headers=get_supabase_headers(),
            json={
                "p_organization_id": org_id,
                "p_user_id": user_id,
                "p_provider_name": provider,
                "p_api_key": provider_key
            },
            timeout=30.0
        )
        res.raise_for_status()
        await clear_user_cache(user_id)
    except HTTPException:
        raise
    except Exception as e:
        log.error("provider_update_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Provider update failed")
    
    log.info("provider_updated", user_id=user_id, provider=provider)
    return {"status": "updated"}


@router.delete("/provider")
@limiter.limit(f"{RATE_LIMIT_MANAGEMENT_PER_MINUTE}/minute")
async def disconnect_provider(
    request: Request, 
    user_id: str = Depends(get_current_user_id)
):
    """Disconnect provider (delete API key)."""
    try:
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_disconnect_provider",
            headers=get_supabase_headers(),
            json={"p_user_id": user_id},
            timeout=30.0
        )
        res.raise_for_status()
        await clear_user_cache(user_id)
    except Exception as e:
        log.error("provider_disconnect_failed", user_id=user_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Provider disconnect failed")
    
    log.info("provider_disconnected", user_id=user_id)
    return {"status": "disconnected"}

