"""
SENTRY CONFIGURATION - BACKEND
================================

Server-side error tracking and performance monitoring for FastAPI.

Features:
- Automatic error capture
- Performance/APM monitoring
- Redis integration tracking
- Request/response logging
- SQL query tracking (if applicable)

Setup:
1. pip install sentry-sdk[fastapi]
2. Set SENTRY_DSN environment variable
3. Import in main.py: from sentry_config import init_sentry; init_sentry()
"""

import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from sentry_sdk.integrations.logging import LoggingIntegration


def init_sentry():
    """
    Initialize Sentry for backend error tracking.
    
    Call this BEFORE creating the FastAPI app.
    """
    sentry_dsn = os.getenv("SENTRY_DSN")
    environment = os.getenv("ENVIRONMENT", "production")
    
    if not sentry_dsn:
        print("⚠️  SENTRY_DSN not set. Error tracking disabled.")
        return
    
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=environment,
        
        # Performance monitoring (10% sample rate)
        traces_sample_rate=0.1,
        
        # Profiling (10% of transactions)
        profiles_sample_rate=0.1,
        
        # Integrations
        integrations=[
            FastApiIntegration(
                transaction_style="endpoint",  # Group by endpoint, not full path
            ),
            RedisIntegration(),
            HttpxIntegration(),
            LoggingIntegration(
                level=None,        # Capture all logs
                event_level="error"  # Only send errors as events
            ),
        ],
        
        # Scrub sensitive data
        before_send=before_send_hook,
        before_breadcrumb=before_breadcrumb_hook,
        
        # Release tracking (set via env var or git commit)
        release=os.getenv("SENTRY_RELEASE", "oxy-engine@unknown"),
        
        # Don't send events in test environment
        enabled=environment != "test",
    )
    
    print(f"✅ Sentry initialized (environment: {environment})")


def before_send_hook(event, hint):
    """
    Filter and scrub events before sending to Sentry.
    
    CRITICAL: Never send PII or secrets!
    """
    # Don't send health check errors
    if event.get("request", {}).get("url", "").endswith("/health"):
        return None
    
    # Scrub Authorization headers
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        if "Authorization" in headers:
            headers["Authorization"] = "[Filtered]"
        if "authorization" in headers:
            headers["authorization"] = "[Filtered]"
    
    # Scrub API keys from request bodies
    if "request" in event and "data" in event["request"]:
        # This is best-effort; structured data may need deeper scrubbing
        data_str = str(event["request"]["data"])
        if "sk-" in data_str or "oxy_sk_" in data_str:
            event["request"]["data"] = "[Filtered: contains API keys]"
    
    # Filter out noisy errors
    if event.get("level") == "info":
        return None  # Don't send info-level events
    
    return event


def before_breadcrumb_hook(crumb, hint):
    """
    Filter breadcrumbs before adding to event context.
    """
    # Don't capture health check breadcrumbs
    if crumb.get("category") == "httpx" and "/health" in str(crumb.get("data", {})):
        return None
    
    # Scrub Authorization from HTTP breadcrumbs
    if crumb.get("category") == "httpx" and "headers" in crumb.get("data", {}):
        headers = crumb["data"]["headers"]
        if isinstance(headers, dict):
            headers.pop("Authorization", None)
            headers.pop("authorization", None)
    
    return crumb


# Context managers for custom spans
def trace_operation(operation_name: str):
    """
    Context manager for tracing custom operations.
    
    Usage:
        with trace_operation("expensive_computation"):
            result = expensive_function()
    """
    return sentry_sdk.start_span(op="function", description=operation_name)

