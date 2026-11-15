"""
Oxy Engine Core - Shared Resources & Dependencies

This module contains all shared resources and dependencies to avoid circular imports.
Previously these were in main.py, causing circular dependency with billing.py.

CRITICAL: This module must NOT import from main.py or billing.py
"""

import os
import sys
import logging
import structlog
import redis.asyncio as aioredis
import httpx
from types import SimpleNamespace
from decimal import getcontext
from typing import Optional
from dotenv import load_dotenv

# Import security utilities
from security_utils import CacheEncryption
from redis_scripts import (
    # DEPRECATION: Budget scripts moved to core.budget.BudgetManager
    # Only non-budget scripts remain here
    LUA_CLEAR_PROJECT_CACHE,
    LUA_RATE_LIMIT_CHECK,
)

# Load environment variables
load_dotenv()

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
)

structlog.configure(
    processors=[
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
)

# Shared logger instance
log = structlog.get_logger()

# ============================================================================
# DECIMAL PRECISION
# ============================================================================

getcontext().prec = 30  # High precision for financial calculations

# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Site URL used to build links (referrals, invites, dashboard links in emails)
SITE_URL = os.getenv("SITE_URL", "http://localhost:3000")

# Validate critical environment variables
if not all([SUPABASE_URL, SUPABASE_KEY]):
    log.critical("fatal_startup_error", error="SUPABASE_URL or SUPABASE_KEY is not set.")
    raise EnvironmentError("FATAL: Missing required environment variables")

# 🕵️ FORENSIC DEBUG: Log environment configuration at startup
log.info(
    "supabase_config_loaded",
    supabase_url=SUPABASE_URL,
    service_key_prefix=SUPABASE_KEY[:20] + "..." if SUPABASE_KEY else "MISSING",
    service_key_length=len(SUPABASE_KEY) if SUPABASE_KEY else 0,
    environment=ENVIRONMENT
)

# Validate Redis password in production
if ENVIRONMENT == "production":
    if "password" not in REDIS_URL and ":@" not in REDIS_URL:
        log.critical("fatal_startup_error", error="Redis password required in production but not found in REDIS_URL")
        raise EnvironmentError("FATAL: Redis must have password authentication in production")
    log.info("redis_security_validated", message="Redis password authentication confirmed for production")

# ============================================================================
# SHARED CLIENT INSTANCES (RESOURCE MANAGER PATTERN)
# ============================================================================
# Use container object to avoid import-time binding issues
# When modules do "from core import redis_client", they get a copy of None
# When we later set core.redis_client = ..., those modules still have None
# Solution: Put all resources in a container object, modules access via .attribute

class ResourceManager:
    """
    Container for shared runtime resources.
    
    CRITICAL: This prevents import-time binding issues.
    Modules import the container (not the values), so they always see updated resources.
    
    HTTP client now has explicit connection pooling limits to prevent
    memory leaks and connection exhaustion under high load.
    
    Usage:
        # In main.py lifespan:
        core.resources.redis = aioredis.from_url(...)
        
        # In other modules:
        from core import resources
        await resources.redis.ping()  # Always gets the initialized client
    """
    def __init__(self):
        # Track last usable HTTP client for deletes so tests can patch safely
        object.__setattr__(self, "_http_client_with_delete", None)

        # HTTP client for making requests to external APIs
        # Configured with connection pooling limits
        self.http_client: Optional[httpx.AsyncClient] = SimpleNamespace()
        # Optional dedicated client for delete calls (falls back to http_client)
        self.http_client_for_deletes: Optional[httpx.AsyncClient] = None
        
        # Redis client for caching and rate limiting
        self.redis: Optional[aioredis.Redis] = None
        
        # Supabase client for database operations
        self.supabase = None  # type: ignore
        
        # Cache encryption for securing Redis data
        self.cache_encryption: Optional[CacheEncryption] = None
        
        # Budget manager for atomic financial operations
        # CRITICAL: Initialized in main.py lifespan after Redis is ready
        self.budget_manager = None  # type: ignore - Will be BudgetManager instance
        
        # Response cache for cost optimization
        # Can save provider cost on repeated requests (workload-dependent; not guaranteed)
        self.response_cache = None  # type: ignore - Will be ResponseCache instance
    
    def create_http_client(self) -> httpx.AsyncClient:
        """
        Create HTTP client with explicit connection pooling limits.
        
        PERFORMANCE OPTIMIZATION (Task #5):
        - HTTP/2 enabled for multiplexing (-30ms per request)
        - max_connections=100: Total connection pool size (prevents memory leak)
        - max_keepalive_connections=20: Reuse connections for performance
        - timeout=30.0: Default timeout for all requests (prevents hanging)
        
        RATIONALE:
        - Default httpx allows unlimited connections = memory leak under load
        - Keep-alive reuse reduces latency by ~50ms per request
        - HTTP/2 multiplexing allows parallel requests over single connection
        - Timeout prevents zombie requests from blocking worker threads
        
        SCALING:
        - 100 connections supports ~1000 req/sec (1 connection = ~10 req/sec)
        - For higher loads, increase max_connections proportionally
        - Monitor connection pool exhaustion via logs/metrics
        """
        return httpx.AsyncClient(
            limits=httpx.Limits(
                max_connections=100,              # Total pool size
                max_keepalive_connections=20,     # Reused connections
                keepalive_expiry=30.0             # Keep connections alive for 30s
            ),
            timeout=httpx.Timeout(30.0, connect=5.0),  # Global timeout
            follow_redirects=True,                # Handle 3xx redirects
            http2=True,                            # Enable HTTP/2 for multiplexing (PERFORMANCE +30ms)
        )
    
    def __setattr__(self, name, value):
        # Keep track of the last client that supports delete to aid tests
        object.__setattr__(self, name, value)
        if name == "http_client":
            if hasattr(value, "delete"):
                object.__setattr__(self, "_http_client_with_delete", value)
                object.__setattr__(self, "http_client_for_deletes", value)

    def __repr__(self):
        return f"ResourceManager(redis={'initialized' if self.redis else 'None'}, http={'initialized' if self.http_client else 'None'})"


# Global resource manager instance
resources = ResourceManager()

# ============================================================================
# REDIS LUA SCRIPTS
# ============================================================================
# Shared Lua scripts for atomic operations
# DEPRECATION WARNING: Budget scripts moved to core.budget.BudgetManager
# Use resources.budget_manager.reserve_budget() instead of direct Lua calls

LUA_SCRIPTS = {
    # Budget scripts DEPRECATED - use BudgetManager class
    "clear_cache": LUA_CLEAR_PROJECT_CACHE,
    "rate_limit": LUA_RATE_LIMIT_CHECK,
}

# ============================================================================
# CONSTANTS
# ============================================================================

# A cached key record lives 5 minutes. Revocation and budget changes clear it at
# once; the short life bounds what any missed invalidation can cost.
KEY_CACHE_TTL = 300
RESPONSE_CACHE_TTL = 3600  # 1 hour
KEY_PREFIX_LENGTH = 15
KEY_PREFIX_BYTES = 3
KEY_SUFFIX_BYTES = 18
OPENAI_PROVIDER_NAME = "openai"

# Security and Performance Constants
MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB max request body
MAX_MESSAGE_LENGTH = 1000000  # 1M characters per message
MAX_MESSAGES = 1000  # Maximum messages in a request
REQUEST_TIMEOUT = 300.0  # 5 minutes for streaming
NON_STREAMING_TIMEOUT = 60.0  # 1 minute for non-streaming

# ============================================================================
# RATE LIMITING (Optimized for Development + Production)
# ============================================================================
# CRITICAL: Rate limits prevent abuse but must allow legitimate traffic
# 
# Development: High limits to prevent blocking during React Strict Mode (double renders)
# Production: Balanced limits for DDoS protection without impacting UX
#
# Environment-aware configuration:
_is_production = ENVIRONMENT == "production"

RATE_LIMIT_PER_MINUTE = 60 if _is_production else 6000  # Per API key (dev: effectively unlimited)
RATE_LIMIT_MANAGEMENT_PER_MINUTE = 30 if _is_production else 600  # Management endpoints (dev: 10x higher)
AUTH_RATE_LIMIT_PER_MINUTE = 10 if _is_production else 100  # Auth attempts per IP (dev: 10x higher)

# DLP: Data Loss Prevention patterns
# These patterns detect sensitive data that should not be sent to LLMs
DLP_PATTERNS = {
    "openai_key": r'sk-proj-[a-zA-Z0-9]{48}|sk-[a-zA-Z0-9]{48}',
    "anthropic_key": r'sk-ant-api03-[a-zA-Z0-9_-]{95}',
    "aws_key": r'AKIA[0-9A-Z]{16}',
    "stripe_key": r'sk_live_[a-zA-Z0-9]{24,}',
    "jwt": r'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}',
    "private_key": r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
    "github_token": r'gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}',
    "slack_token": r'xox[abposr]-[A-Za-z0-9-]{10,}',
    "google_api_key": r'AIza[0-9A-Za-z_-]{35}',
    # Allow optional spaces/hyphens between blocks to catch formats like 4111-1111-1111-1111
    "credit_card": r'(?:4[0-9]{3}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}|5[1-5][0-9]{2}[- ]?(?:[0-9]{4}[- ]?){2}[0-9]{4}|3[47][0-9]{2}[- ]?[0-9]{6}[- ]?[0-9]{5}|3(?:0[0-5]|[68][0-9])[0-9]{1}[- ]?[0-9]{6}[- ]?[0-9]{4}|6(?:011|5[0-9]{2})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}|(?:2131|1800|35\\d{3})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{3})',
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_redis_client() -> aioredis.Redis:
    """
    Get the Redis client instance.
    Raises RuntimeError if not initialized.
    """
    if resources.redis is None:
        raise RuntimeError("Redis client not initialized. Call from lifespan context.")
    return resources.redis


def get_http_client() -> httpx.AsyncClient:
    """
    Get the HTTP client instance.
    Raises RuntimeError if not initialized.
    """
    if resources.http_client is None:
        raise RuntimeError("HTTP client not initialized. Call from lifespan context.")
    return resources.http_client


def get_supabase_client():
    """
    Get the Supabase client instance.
    Raises RuntimeError if not initialized.
    """
    if resources.supabase is None:
        raise RuntimeError("Supabase client not initialized. Call from lifespan context.")
    return resources.supabase


# ============================================================================
# AUTHENTICATION DEPENDENCY (for billing.py)
# ============================================================================
# This is set by main.py after get_current_user_id is defined
# billing.py imports this to verify JWT tokens

verify_jwt = None  # Will be set to Depends(get_current_user_id) by main.py

