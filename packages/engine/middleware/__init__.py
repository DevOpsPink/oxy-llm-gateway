"""
MIDDLEWARE LAYER - OXY ENGINE
=============================
Centralized middleware architecture for maintainability and order enforcement.

CRITICAL: Middleware order matters!
1. Security headers (first - apply to all responses)
2. CSRF validation (protect state-changing operations)
3. Request ID (for tracing)
4. Request size limiter (DoS protection)
5. Auth rate limiting (brute force protection)
6. Global rate limiting (DDoS protection)
7. Rate limit headers (inform clients)

Architecture Pattern: Separation of Concerns
- Each middleware in its own file
- Single Responsibility Principle
- Easy to test, modify, disable
- Clear order enforcement

"""

from .security import add_security_headers, csrf_protection_middleware
from .rate_limit import (
    auth_rate_limit_middleware,
    global_rate_limit_middleware,
    add_rate_limit_headers_middleware
)
from .request import (
    add_request_id_middleware,
    limit_request_size
)
from .geo_blocking import geo_blocking_middleware
from .key_rotation import key_rotation_middleware

__all__ = [
    # Security
    "add_security_headers",
    "csrf_protection_middleware",
    
    # Rate Limiting
    "auth_rate_limit_middleware",
    "global_rate_limit_middleware",
    "add_rate_limit_headers_middleware",
    
    # Request Processing
    "add_request_id_middleware",
    "limit_request_size",
    
    # Geo-blocking
    "geo_blocking_middleware",
    
    # API Key Rotation (SOC 2 Compliance)
    "key_rotation_middleware",
]

