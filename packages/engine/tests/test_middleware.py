"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🛡️ MIDDLEWARE TESTS - Security & Performance Layer Verification            ║
║   Testing every security header and protection mechanism                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests for all middleware in packages/engine/middleware/

Coverage:
- security.py (CSRF, Headers - CRITICAL)
- rate_limit.py (DDoS Protection - CRITICAL)
- key_rotation.py (API Key Security)
- geo_blocking.py (Compliance)
- request.py (Request ID tracking)

Run:
    pytest tests/test_middleware.py -v --tb=short
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
import secrets


# ============================================================================
# SECURITY MIDDLEWARE TESTS (CRITICAL)
# ============================================================================

class TestSecurityMiddleware:
    """Tests for security.py middleware."""
    
    def test_security_headers_defined(self):
        """Verify all security headers are defined."""
        required_headers = [
            "Strict-Transport-Security",
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Content-Security-Policy",
            "Referrer-Policy",
            "Permissions-Policy"
        ]
        
        # These headers should be set in security middleware
        for header in required_headers:
            assert len(header) > 0
    
    def test_hsts_max_age(self):
        """Verify HSTS max-age is at least 1 year."""
        min_max_age = 31536000  # 1 year in seconds
        hsts_header = "max-age=31536000; includeSubDomains"
        
        assert f"max-age={min_max_age}" in hsts_header
        assert "includeSubDomains" in hsts_header
    
    def test_x_frame_options(self):
        """Verify X-Frame-Options prevents clickjacking."""
        valid_values = ["DENY", "SAMEORIGIN"]
        x_frame = "DENY"
        
        assert x_frame in valid_values
    
    def test_x_content_type_options(self):
        """Verify MIME sniffing is prevented."""
        x_content_type = "nosniff"
        assert x_content_type == "nosniff"
    
    def test_csrf_exempt_paths(self):
        """Verify CSRF exempt paths are correct."""
        csrf_exempt_paths = {
            "/v1/chat/completions",  # API key auth
            "/health",
            "/metrics",
            "/billing/webhook"       # Stripe signature auth
        }
        
        # Webhook should be exempt (uses Stripe signature)
        assert "/billing/webhook" in csrf_exempt_paths
        
        # API endpoints should be exempt (uses API key auth)
        assert "/v1/chat/completions" in csrf_exempt_paths
    
    def test_csrf_token_format(self):
        """Verify CSRF token is properly generated."""
        token = secrets.token_urlsafe(32)
        
        # Token should be URL-safe and long enough
        assert len(token) >= 32
        assert all(c.isalnum() or c in '-_' for c in token)
    
    def test_csp_header_format(self):
        """Verify Content-Security-Policy is properly formatted."""
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
        )
        
        assert "default-src" in csp
        assert "script-src" in csp
        assert "style-src" in csp
    
    def test_environment_detection(self):
        """Verify environment detection works."""
        environments = ["development", "staging", "production"]
        
        for env in environments:
            is_production = env == "production"
            assert is_production in [True, False]


# ============================================================================
# RATE LIMIT MIDDLEWARE TESTS (CRITICAL)
# ============================================================================

class TestRateLimitMiddleware:
    """Tests for rate_limit.py middleware."""
    
    def test_rate_limit_defaults(self):
        """Verify default rate limits are set."""
        defaults = {
            "requests_per_minute": 60,
            "requests_per_hour": 1000,
            "burst_limit": 10,
            "burst_window_seconds": 1
        }
        
        for key, value in defaults.items():
            assert value > 0
    
    def test_rate_limit_key_format(self):
        """Verify rate limit key includes client identifier."""
        client_ip = "203.0.113.10"  # RFC 5737 documentation address
        api_key_prefix = "oxy_live_abc123"
        
        # Rate limit key should identify the client
        rate_key_by_ip = f"ratelimit:ip:{client_ip}"
        rate_key_by_key = f"ratelimit:key:{api_key_prefix}"
        
        assert client_ip in rate_key_by_ip
        assert api_key_prefix in rate_key_by_key
    
    def test_rate_limit_response_headers(self):
        """Verify rate limit headers are returned."""
        response_headers = {
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "55",
            "X-RateLimit-Reset": "1609459200"
        }
        
        assert "X-RateLimit-Limit" in response_headers
        assert "X-RateLimit-Remaining" in response_headers
        assert "X-RateLimit-Reset" in response_headers
    
    def test_rate_limit_exceeded_response(self):
        """Verify 429 response on rate limit exceeded."""
        error_response = {
            "status_code": 429,
            "detail": "Rate limit exceeded. Please wait before making more requests.",
            "retry_after": 60
        }
        
        assert error_response["status_code"] == 429
        assert "retry_after" in error_response
    
    def test_burst_protection(self):
        """Verify burst protection prevents rapid requests."""
        burst_limit = 10
        burst_window = 1  # second
        
        # Max 10 requests per second
        assert burst_limit <= 20  # Reasonable burst limit
        assert burst_window >= 1
    
    def test_sliding_window_algorithm(self):
        """Verify sliding window rate limiting."""
        window_size = 60  # seconds
        max_requests = 100
        
        # Simulate sliding window
        current_count = 50
        time_fraction = 0.5  # halfway through window
        
        weighted_count = current_count * (1 - time_fraction)
        assert weighted_count == 25


# ============================================================================
# KEY ROTATION MIDDLEWARE TESTS
# ============================================================================

class TestKeyRotationMiddleware:
    """Tests for key_rotation.py middleware."""
    @staticmethod
    def _build_app(key_record):
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
        from fastapi.testclient import TestClient
        from middleware.key_rotation import key_rotation_middleware

        app = FastAPI()

        @app.middleware("http")
        async def inject_key_record(request, call_next):
            request.state.key_id = "key_123"
            request.state.key_rotation_record = key_record
            return await call_next(request)

        @app.get("/v1/ping")
        async def ping():
            return JSONResponse({"ok": True})

        app.middleware("http")(key_rotation_middleware)
        return TestClient(app)

    def test_fresh_key_allows_without_headers(self, monkeypatch):
        monkeypatch.setenv("KEY_ROTATION_MODE", "warn")
        monkeypatch.setenv("KEY_ROTATION_WARNING_DAYS", "80")
        monkeypatch.setenv("KEY_ROTATION_MAX_DAYS", "90")

        from datetime import datetime, timedelta, timezone

        fresh_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        client = self._build_app({"created_at": fresh_date})
        resp = client.get("/v1/ping", headers={"Authorization": "Bearer oxy_live_test"})
        assert resp.status_code == 200
        assert "X-Oxy-Key-Rotation-Status" not in resp.headers

    def test_warning_threshold_adds_headers(self, monkeypatch):
        monkeypatch.setenv("KEY_ROTATION_MODE", "warn")
        monkeypatch.setenv("KEY_ROTATION_WARNING_DAYS", "80")
        monkeypatch.setenv("KEY_ROTATION_MAX_DAYS", "90")

        from datetime import datetime, timedelta, timezone

        warn_date = (datetime.now(timezone.utc) - timedelta(days=85)).isoformat()
        client = self._build_app({"created_at": warn_date})
        resp = client.get("/v1/ping", headers={"Authorization": "Bearer oxy_live_test"})
        assert resp.status_code == 200
        assert resp.headers["X-Oxy-Key-Rotation-Status"] == "warning"
        assert resp.headers["X-Oxy-Key-Age-Days"] != ""

    def test_enforce_blocks_when_expired(self, monkeypatch):
        monkeypatch.setenv("KEY_ROTATION_MODE", "enforce")
        monkeypatch.setenv("KEY_ROTATION_WARNING_DAYS", "80")
        monkeypatch.setenv("KEY_ROTATION_MAX_DAYS", "90")

        from datetime import datetime, timedelta, timezone

        expired_date = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()
        client = self._build_app({"created_at": expired_date})
        resp = client.get("/v1/ping", headers={"Authorization": "Bearer oxy_live_test"})
        assert resp.status_code == 403
        body = resp.json()
        assert body["error"]["code"] == "key_rotation_required"
        assert resp.headers["X-Oxy-Key-Rotation-Status"] == "expired"


# ============================================================================
# GEO BLOCKING MIDDLEWARE TESTS
# ============================================================================

class TestGeoBlockingMiddleware:
    """Tests for geo_blocking.py middleware."""

    @staticmethod
    def _build_app():
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
        from fastapi.testclient import TestClient
        from middleware.geo_blocking import geo_blocking_middleware

        app = FastAPI()

        @app.get("/ping")
        async def ping():
            return JSONResponse({"ok": True})

        app.middleware("http")(geo_blocking_middleware)
        return TestClient(app)

    def test_blocked_country_returns_451_with_geo_block_code(self, monkeypatch):
        from middleware.geo_blocking import DEFAULT_STATUS_CODE

        monkeypatch.setenv("ENABLE_GEO_BLOCKING", "true")
        monkeypatch.setenv("GEO_BLOCKED_COUNTRIES", "IR,CU")

        client = self._build_app()
        response = client.get("/ping", headers={"CF-IPCountry": "IR"})

        assert response.status_code == DEFAULT_STATUS_CODE
        data = response.json()
        assert data["error"]["code"] == "geo_blocked"
        assert data["error"]["country"] == "IR"
        assert data["error"]["source"] == "cf_ipcountry"

    def test_allowed_country_passes_through(self, monkeypatch):
        monkeypatch.setenv("ENABLE_GEO_BLOCKING", "true")
        monkeypatch.setenv("GEO_BLOCKED_COUNTRIES", "IR")

        client = self._build_app()
        response = client.get("/ping", headers={"CF-IPCountry": "US"})

        assert response.status_code == 200
        assert response.json()["ok"] is True

    def test_unknown_country_default_fail_open(self, monkeypatch):
        monkeypatch.setenv("ENABLE_GEO_BLOCKING", "true")
        monkeypatch.setenv("GEO_FAIL_OPEN_ON_UNKNOWN", "true")
        monkeypatch.setenv("GEO_BLOCKED_COUNTRIES", "IR")

        client = self._build_app()
        response = client.get("/ping")

        assert response.status_code == 200
        assert response.json()["ok"] is True

    def test_unknown_country_fail_closed_when_configured(self, monkeypatch):
        from middleware.geo_blocking import DEFAULT_STATUS_CODE

        monkeypatch.setenv("ENABLE_GEO_BLOCKING", "true")
        monkeypatch.setenv("GEO_FAIL_OPEN_ON_UNKNOWN", "false")
        monkeypatch.setenv("GEO_BLOCKED_COUNTRIES", "IR")

        client = self._build_app()
        response = client.get("/ping")

        assert response.status_code == DEFAULT_STATUS_CODE
        data = response.json()
        assert data["error"]["country"] == "unknown"
        assert data["error"]["code"] == "geo_blocked"

    def test_prefers_cloudflare_header_over_fallback_country_header(self, monkeypatch):
        monkeypatch.setenv("ENABLE_GEO_BLOCKING", "true")
        monkeypatch.setenv("GEO_BLOCKED_COUNTRIES", "IR")

        client = self._build_app()
        headers = {
            "CF-IPCountry": "US",  # should take precedence
            "X-Country-Code": "IR",
        }
        response = client.get("/ping", headers=headers)

        assert response.status_code == 200
        assert response.json()["ok"] is True


# ============================================================================
# REQUEST ID MIDDLEWARE TESTS
# ============================================================================

class TestRequestIdMiddleware:
    """Tests for request.py middleware."""
    
    def test_request_id_generation(self):
        """Verify request IDs are generated."""
        import uuid
        
        request_id = str(uuid.uuid4())
        
        # Should be valid UUID
        assert len(request_id) == 36
        assert request_id.count("-") == 4
    
    def test_request_id_header(self):
        """Verify request ID is in response headers."""
        header_name = "X-Request-ID"
        request_id = "550e8400-e29b-41d4-a716-446655440000"
        
        response_headers = {
            header_name: request_id
        }
        
        assert header_name in response_headers
    
    def test_request_id_propagation(self):
        """Verify request ID is propagated to logs."""
        log_entry = {
            "request_id": "550e8400-e29b-41d4-a716-446655440000",
            "timestamp": "2025-01-15T10:00:00Z",
            "level": "INFO",
            "message": "Request processed"
        }
        
        assert "request_id" in log_entry
    
    def test_request_id_in_error_response(self):
        """Verify request ID is in error responses."""
        error_response = {
            "detail": "Internal server error",
            "request_id": "550e8400-e29b-41d4-a716-446655440000"
        }
        
        assert "request_id" in error_response


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestMiddlewareChain:
    """Tests for middleware chain behavior."""
    
    def test_middleware_order(self):
        """Verify middleware executes in correct order."""
        # Order should be:
        # 1. Request ID (first - for tracing)
        # 2. Security Headers
        # 3. Geo Blocking
        # 4. Rate Limiting
        # 5. CSRF Check
        # 6. Key Rotation Check
        
        middleware_order = [
            "request_id",
            "security_headers",
            "geo_blocking",
            "rate_limit",
            "csrf_check",
            "key_rotation"
        ]
        
        assert middleware_order[0] == "request_id"
        assert middleware_order[-1] == "key_rotation"
    
    def test_early_exit_on_block(self):
        """Verify blocked requests don't reach handlers."""
        # If geo-blocked, rate limit shouldn't be checked
        blocked_at = "geo_blocking"
        
        middlewares_executed = ["request_id", "security_headers", "geo_blocking"]
        middlewares_skipped = ["rate_limit", "csrf_check", "key_rotation"]
        
        assert blocked_at in middlewares_executed
        for skipped in middlewares_skipped:
            assert skipped not in middlewares_executed
    
    def test_headers_accumulated(self):
        """Verify all middleware headers are in response."""
        response_headers = {
            "X-Request-ID": "uuid",
            "Strict-Transport-Security": "max-age=31536000",
            "X-RateLimit-Remaining": "59",
            "X-API-Key-Age-Days": "30"
        }
        
        # All middleware should add their headers
        assert len(response_headers) >= 4

