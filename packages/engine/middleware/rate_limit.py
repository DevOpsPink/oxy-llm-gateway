"""
RATE LIMITING MIDDLEWARE
========================
Multi-layer rate limiting for DDoS protection and abuse prevention.

Layers:
1. Auth Rate Limiting: Prevent brute force attacks on credentials
2. Global Rate Limiting: Protect infrastructure from DDoS
3. Rate Limit Headers: Inform clients of their limits

Environment-Aware:
- Development: High limits (prevent blocking during React Strict Mode)
- Production: Strict limits (DDoS protection)

"""

import os
from fastapi import Request
from fastapi.responses import JSONResponse
from core import log, resources
from redis_scripts import LUA_RATE_LIMIT_CHECK, parse_rate_limit_result
from collections import deque
from datetime import datetime

# Environment detection
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# Rate limit configuration (environment-aware)
# Development: 10x higher limits to prevent blocking legitimate traffic
# Production: Strict limits for security
AUTH_RATE_LIMIT_PER_MINUTE = 10 if IS_PRODUCTION else 100
GLOBAL_RATE_LIMIT_PER_SECOND = 1000 if IS_PRODUCTION else 10000
GLOBAL_RATE_LIMIT_WINDOW = 1  # 1 second window

# Emergency fallback (when Redis is down)
emergency_rate_limit = deque(maxlen=1000)


def get_remote_address(request: Request) -> str:
    """
    Get client IP address from request.
    
    Checks X-Forwarded-For header first (for reverse proxy setups),
    falls back to direct connection IP.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def auth_rate_limit_middleware(request: Request, call_next):
    """
    Rate limit authentication attempts per IP address.
    
    CRITICAL: Prevents brute force attacks on JWT tokens and API keys.
    
    Limits:
    - 10 attempts per minute per IP
    - Applies to /management/* (user sign-in and account endpoints). Gateway traffic on
      /v1/chat/completions is limited per API key and per second instead; counting it here
      capped every client IP at AUTH_RATE_LIMIT_PER_MINUTE model calls a minute.
    - Uses Redis Lua script for atomic counting
    
    Fail-Open: If Redis is down, allows request (availability > security for non-critical paths)
    """
    # Only rate limit auth endpoints
    if request.url.path.startswith("/management/"):
        auth_header = request.headers.get("Authorization", "")
        
        if auth_header:
            client_ip = get_remote_address(request)
            rate_limit_key = f"auth_attempt:{client_ip}"
            
            try:
                # Use Lua script for atomic rate limit check
                result = await resources.redis.eval(
                    LUA_RATE_LIMIT_CHECK,
                    1,  # numkeys
                    rate_limit_key,  # key1
                    AUTH_RATE_LIMIT_PER_MINUTE,  # arg1
                    60  # arg2: 10 attempts per 60 seconds
                )
                
                parsed = parse_rate_limit_result(result)
                
                if parsed["status"] == "RATE_LIMIT_EXCEEDED":
                    log.warn(
                        "auth_rate_limit_exceeded", 
                        ip=client_ip, 
                        attempts=parsed["current_count"],
                        path=request.url.path
                    )
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": "Too many authentication attempts. Please try again later.",
                            "retry_after": parsed["ttl_seconds"]
                        },
                        headers={"Retry-After": str(parsed["ttl_seconds"])}
                    )
            except Exception as e:
                # If Redis fails, allow request (fail open for availability)
                log.error("auth_rate_limit_check_failed", ip=client_ip, error=str(e))

    # Gateway traffic: throttle only failed authentication per client IP, so key
    # guessing stays slow while authenticated traffic is limited per key instead.
    if request.url.path == "/v1/chat/completions":
        client_ip = get_remote_address(request)
        fail_key = f"auth_fail:{client_ip}"
        try:
            failures = await resources.redis.get(fail_key)
            if failures and int(failures) >= AUTH_RATE_LIMIT_PER_MINUTE:
                log.warn("auth_failure_limit_exceeded", ip=client_ip, failures=int(failures))
                return JSONResponse(
                    status_code=429,
                    content={"error": "rate_limit_exceeded", "message": "Too many failed authentication attempts."},
                    headers={"Retry-After": "60"},
                )
        except Exception as e:
            log.error("auth_failure_limit_check_failed", ip=client_ip, error=str(e))
        response = await call_next(request)
        if response.status_code == 401:
            try:
                count = await resources.redis.incr(fail_key)
                if count == 1:
                    await resources.redis.expire(fail_key, 60)
            except Exception as e:
                log.error("auth_failure_count_failed", ip=client_ip, error=str(e))
        return response

    response = await call_next(request)
    return response


async def global_rate_limit_middleware(request: Request, call_next):
    """
    CRITICAL: Global application-level rate limiting to prevent DDoS.
    
    Limits total requests per second across ALL users/API keys.
    This prevents attackers from creating 1000 free accounts and overwhelming the system.
    
    Implementation: Redis atomic counter with 1-second TTL + in-memory fallback.
    
    Limit: 1000 requests/second (adjustable based on infrastructure capacity)
    """
    global_rate_key = "global_rate_limit:requests"
    
    try:
        # Use Lua script for atomic increment + TTL
        result = await resources.redis.eval(
            LUA_RATE_LIMIT_CHECK,
            1,  # numkeys
            global_rate_key,  # key1
            GLOBAL_RATE_LIMIT_PER_SECOND,  # arg1
            GLOBAL_RATE_LIMIT_WINDOW  # arg2
        )
        
        parsed = parse_rate_limit_result(result)
        
        if parsed["status"] == "RATE_LIMIT_EXCEEDED":
            log.warn(
                "global_rate_limit_exceeded", 
                current_count=parsed["current_count"],
                limit=GLOBAL_RATE_LIMIT_PER_SECOND,
                path=request.url.path,
                severity="CRITICAL_DDOS_PROTECTION"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Service temporarily unavailable due to high traffic. Please try again in a moment.",
                    "retry_after": parsed["ttl_seconds"]
                },
                headers={"Retry-After": str(parsed["ttl_seconds"])}
            )
    except Exception as e:
        # In-memory fallback during Redis outage
        now = datetime.now().timestamp()
        
        # Clean old entries (older than 1 second)
        while emergency_rate_limit and emergency_rate_limit[0] < now - 1:
            emergency_rate_limit.popleft()
        
        # Check limit
        if len(emergency_rate_limit) >= GLOBAL_RATE_LIMIT_PER_SECOND:
            log.warn(
                "global_rate_limit_exceeded_fallback",
                current_count=len(emergency_rate_limit),
                limit=GLOBAL_RATE_LIMIT_PER_SECOND
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Service temporarily unavailable due to high traffic.",
                    "retry_after": 1
                },
                headers={"Retry-After": "1"}
            )
        
        # Add current request
        emergency_rate_limit.append(now)
        
        log.error("global_rate_limit_check_failed_using_fallback", error=str(e))
    
    response = await call_next(request)
    return response


async def add_rate_limit_headers_middleware(request: Request, call_next):
    """
    Add rate limit information to response headers.
    
    Helps clients implement proper backoff strategies.
    
    Headers:
    - X-RateLimit-Limit: Maximum requests allowed
    - X-RateLimit-Remaining: Requests remaining in current window
    - X-RateLimit-Reset: Unix timestamp when limit resets
    """
    response = await call_next(request)
    
    # Only add headers for authenticated endpoints
    if request.url.path.startswith(("/v1/", "/management/")):
        # These values would ideally come from the rate limiter
        # For now, we set static values (can be enhanced with actual counter)
        response.headers['X-RateLimit-Limit'] = '60'
        response.headers['X-RateLimit-Remaining'] = '59'  # Placeholder
        response.headers['X-RateLimit-Reset'] = str(int(datetime.now().timestamp()) + 60)
    
    return response

