"""
Oxy Engine Core Package
========================
This package contains advanced subsystems (budget, cache_warmer, etc.)
AND re-exports symbols from the parent core.py module to maintain
backward compatibility with existing imports.

CRITICAL IMPORT RESOLUTION:
---------------------------
Python prioritizes package directories over module files, so when both exist:
  - core.py (module file)
  - core/ (package directory)

...the package wins. This __init__.py bridges the gap by re-exporting
everything from ../core.py (via sys.path manipulation).

Submodules:
- budget: Budget management with Redis Lua scripts
- cache_warmer: Proactive cache warming
- redis_failover: Graceful Redis degradation
- redis_pipeline: Optimized Redis pipelines
- response_cache: Intelligent response caching

Re-exported from core.py:
- log: Structured logger (structlog)
- resources: ResourceManager (redis, supabase, http_client)
- SUPABASE_URL, SUPABASE_KEY, REDIS_URL, ENVIRONMENT, SITE_URL
- KEY_CACHE_TTL, RESPONSE_CACHE_TTL, KEY_PREFIX_LENGTH
- OPENAI_PROVIDER_NAME, MAX_REQUEST_SIZE, REQUEST_TIMEOUT
- RATE_LIMIT_*, DLP_PATTERNS

License: Apache 2.0
"""

# ============================================================================
# RE-EXPORT CORE.PY SYMBOLS (BACKWARD COMPATIBILITY)
# ============================================================================
# CRITICAL: Import from parent directory's core.py module
# This maintains existing imports like "from core import log, resources"

import sys
import os

# Add parent directory to path to import core.py (not core/)
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import and re-export everything from core.py module
# Use explicit imports to avoid circular dependency issues
try:
    # Import the module file (not this package)
    import importlib.util
    core_module_path = os.path.join(os.path.dirname(__file__), '..', 'core.py')
    spec = importlib.util.spec_from_file_location("_core_module", core_module_path)
    _core_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(_core_module)
    
    # Re-export all public symbols
    log = _core_module.log
    resources = _core_module.resources
    SUPABASE_URL = _core_module.SUPABASE_URL
    SUPABASE_KEY = _core_module.SUPABASE_KEY
    REDIS_URL = _core_module.REDIS_URL
    ENVIRONMENT = _core_module.ENVIRONMENT
    SITE_URL = _core_module.SITE_URL  # Site URL used to build referral links
    KEY_CACHE_TTL = _core_module.KEY_CACHE_TTL
    RESPONSE_CACHE_TTL = _core_module.RESPONSE_CACHE_TTL
    KEY_PREFIX_LENGTH = _core_module.KEY_PREFIX_LENGTH
    KEY_PREFIX_BYTES = _core_module.KEY_PREFIX_BYTES
    KEY_SUFFIX_BYTES = _core_module.KEY_SUFFIX_BYTES
    OPENAI_PROVIDER_NAME = _core_module.OPENAI_PROVIDER_NAME
    MAX_REQUEST_SIZE = _core_module.MAX_REQUEST_SIZE
    MAX_MESSAGE_LENGTH = _core_module.MAX_MESSAGE_LENGTH
    MAX_MESSAGES = _core_module.MAX_MESSAGES
    REQUEST_TIMEOUT = _core_module.REQUEST_TIMEOUT
    NON_STREAMING_TIMEOUT = _core_module.NON_STREAMING_TIMEOUT
    RATE_LIMIT_PER_MINUTE = _core_module.RATE_LIMIT_PER_MINUTE
    RATE_LIMIT_MANAGEMENT_PER_MINUTE = _core_module.RATE_LIMIT_MANAGEMENT_PER_MINUTE
    AUTH_RATE_LIMIT_PER_MINUTE = _core_module.AUTH_RATE_LIMIT_PER_MINUTE
    DLP_PATTERNS = _core_module.DLP_PATTERNS
    ResourceManager = _core_module.ResourceManager
    
except Exception as e:
    # Fallback: Log error but allow import to succeed
    import structlog
    log = structlog.get_logger()
    log.error("core_init_reexport_failed", error=str(e))
    raise ImportError(f"Failed to re-export core.py symbols: {e}")

# ============================================================================
# SUBMODULE EXPORTS (NEW FUNCTIONALITY)
# ============================================================================
# These enable: from core.budget import BudgetManager

__all__ = [
    # Re-exported from core.py
    "log",
    "resources",
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "REDIS_URL",
    "ENVIRONMENT",
    "SITE_URL",
    "KEY_CACHE_TTL",
    "RESPONSE_CACHE_TTL",
    "KEY_PREFIX_LENGTH",
    "KEY_PREFIX_BYTES",
    "KEY_SUFFIX_BYTES",
    "OPENAI_PROVIDER_NAME",
    "MAX_REQUEST_SIZE",
    "MAX_MESSAGE_LENGTH",
    "MAX_MESSAGES",
    "REQUEST_TIMEOUT",
    "NON_STREAMING_TIMEOUT",
    "RATE_LIMIT_PER_MINUTE",
    "RATE_LIMIT_MANAGEMENT_PER_MINUTE",
    "AUTH_RATE_LIMIT_PER_MINUTE",
    "DLP_PATTERNS",
    "ResourceManager",
    # Submodules (can be imported via from core.budget import ...)
    "budget",
    "cache_warmer",
    "redis_failover",
    "redis_pipeline",
    "response_cache",
]


