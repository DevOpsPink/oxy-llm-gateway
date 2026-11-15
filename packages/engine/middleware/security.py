"""
SECURITY MIDDLEWARE
===================
HTTP security headers and CSRF protection.

Implements:
- HSTS (HTTP Strict Transport Security)
- Content Security Policy
- X-Frame-Options (clickjacking prevention)
- X-Content-Type-Options (MIME sniffing prevention)
- Referrer-Policy
- Permissions-Policy
- CSRF Double Submit Cookie Pattern

"""

import os
import secrets
import structlog
from fastapi import Request
from fastapi.responses import JSONResponse

# Initialize logger
log = structlog.get_logger()

# Environment detection
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# CSRF Configuration
CSRF_TOKEN_HEADER = "X-CSRF-Token"
CSRF_TOKEN_COOKIE = "csrf_token"

# CSRF EXEMPT PATHS (API key auth, not session-based)
# CRITICAL: Webhooks use their OWN signature verification (not CSRF)
CSRF_EXEMPT_PATHS = {
    "/v1/chat/completions",  # API key authenticated
    "/health",               # Public healthcheck
    "/metrics",              # Public metrics
    "/billing/webhook",      # 🔒 Stripe webhook (uses Stripe-Signature header, not CSRF)
}


async def add_security_headers(request: Request, call_next):
    """
    Add comprehensive HTTP security headers to all responses.
    
    Headers Applied:
    - HSTS: Force HTTPS for 1 year
    - X-Content-Type-Options: Prevent MIME sniffing
    - X-Frame-Options: Prevent clickjacking
    - X-XSS-Protection: Enable browser XSS filter
    - Content-Security-Policy: Restrict resource loading
    - Referrer-Policy: Control referrer information leakage
    - Permissions-Policy: Disable unnecessary browser features
    """
    response = await call_next(request)
    
    # HSTS: Force HTTPS for 1 year (31536000 seconds)
    # CRITICAL: Only enable in production with valid SSL certificate
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Prevent MIME-type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevent clickjacking attacks
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Enable browser XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Content Security Policy (CSP)
    # IMPORTANT: Adjust for your frontend domain
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Allow inline scripts for FastAPI docs
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://api.openai.com https://*.supabase.co; "
        "frame-ancestors 'none';"
    )
    
    # Control referrer information leakage
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Disable unnecessary browser features (Permissions Policy)
    response.headers['Permissions-Policy'] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "gyroscope=(), "
        "accelerometer=()"
    )
    
    return response


async def csrf_protection_middleware(request: Request, call_next):
    """
    CSRF Protection via Double-Submit Cookie Pattern.
    
    SECURITY:
    - Validates X-CSRF-Token header matches csrf_token cookie
    - Only enforced for state-mutating operations (POST/PUT/DELETE/PATCH)
    - Public API endpoints (API key auth) are exempt
    
    COMPLIANCE:
    - OWASP CSRF Prevention Cheat Sheet compliant
    - Adds defense-in-depth to existing JWT + CORS protection
    
    EXEMPTIONS:
    - requests with an Oxy API key (Authorization: Bearer oxy_...)
    - /v1/chat/completions (API key auth, not session-based)
    - /health, /metrics (public endpoints)
    """
    # Only validate state-mutating requests
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        # Requests authenticated with an Oxy API key are not exposed to CSRF: a
        # browser never attaches that Authorization header on its own. Without
        # this, every API-key POST (the kill switch included) answered 403.
        uses_api_key = request.headers.get("authorization", "").startswith("Bearer oxy_")
        # Check if path is exempt from CSRF validation
        if request.url.path not in CSRF_EXEMPT_PATHS and not uses_api_key:
            csrf_token = request.headers.get(CSRF_TOKEN_HEADER)
            csrf_cookie = request.cookies.get(CSRF_TOKEN_COOKIE)
            
            # Validate token matches cookie (double-submit pattern)
            if not csrf_token or not csrf_cookie or csrf_token != csrf_cookie:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "CSRF validation failed",
                        "detail": "Invalid or missing CSRF token. Ensure X-CSRF-Token header matches csrf_token cookie."
                    }
                )
    
    response = await call_next(request)
    
    # Generate and set CSRF token if missing
    # CRITICAL: Set on ALL requests (not just GET) to ensure frontend always has token
    # This prevents "CSRF token missing" errors on first POST request
    if not request.cookies.get(CSRF_TOKEN_COOKIE):
        csrf_token = secrets.token_urlsafe(32)
        
        # Log cookie configuration in development for debugging
        if not IS_PRODUCTION:
            log.debug(
                "csrf_cookie_being_set",
                environment=ENVIRONMENT,
                is_production=IS_PRODUCTION,
                secure_flag=IS_PRODUCTION,
                httponly=False,
                samesite="lax"
            )
        
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE,
            value=csrf_token,
            httponly=False,  # Must be readable by JavaScript for X-CSRF-Token header
            secure=IS_PRODUCTION,  # HTTPS only in production, allow HTTP in development
            samesite="lax",  # CSRF protection (allows same-site GET, blocks cross-site POST)
            max_age=86400,   # 24 hours
            path="/",        # Available to all routes
            domain=None      # CRITICAL: Don't set domain for localhost compatibility
        )
    
    return response

