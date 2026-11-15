"""
REQUEST PROCESSING MIDDLEWARE
==============================
Request lifecycle management: ID tracking, size limiting.

Implements:
- Request ID generation and propagation
- Request size limiting (DoS protection)
- Structured logging context binding

"""

import uuid
import structlog
from contextvars import ContextVar
from fastapi import Request
from fastapi.responses import JSONResponse

# Request ID context var for correlation
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")

# Configuration
MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB


async def add_request_id_middleware(request: Request, call_next):
    """
    Add X-Request-ID to all requests and responses.
    
    Enables correlation between frontend errors and backend logs.
    
    CRITICAL: All log entries automatically include request_id via contextvars.
    
    Flow:
    1. Check if client sent X-Request-ID (for retry correlation)
    2. If not, generate new UUID
    3. Bind to structlog context (auto-included in all logs)
    4. Add to response headers
    5. Clear context after request
    """
    request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    request_id_ctx.set(request_id)
    
    # Bind request_id to structlog context for automatic inclusion in all logs
    structlog.contextvars.bind_contextvars(request_id=request_id)
    
    try:
        response = await call_next(request)
        response.headers['X-Request-ID'] = request_id
        return response
    finally:
        # Clear context after request
        structlog.contextvars.clear_contextvars()


async def limit_request_size(request: Request, call_next):
    """
    Limit request body size to prevent memory exhaustion attacks.
    
    SECURITY: Prevents DoS attacks via massive request bodies.
    
    Attack Vector:
    - Attacker sends 1GB JSON body
    - Server tries to parse entire body into memory
    - OOM kill → service down
    
    Protection:
    - Reject requests >10MB with 413 Payload Too Large
    - Check Content-Length header before processing
    
    Limit: 10MB (configurable via MAX_REQUEST_SIZE)
    """
    if request.method in ["POST", "PUT", "PATCH"]:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "Request entity too large",
                    "max_size_mb": MAX_REQUEST_SIZE / (1024 * 1024),
                    "your_size_mb": int(content_length) / (1024 * 1024)
                }
            )
    return await call_next(request)

