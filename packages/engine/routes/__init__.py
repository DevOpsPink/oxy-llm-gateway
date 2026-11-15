"""
Oxy Engine Routes Module
=========================
Modular router architecture for scalability.

Each router handles a specific domain:
- auth: JWT validation, user onboarding, profile management
- billing: Stripe subscription management, webhooks, payment processing
- proxy: AI gateway to OpenAI/Anthropic/Google (NOT YET EXTRACTED)
- management: Projects, API keys, settings (NOT YET EXTRACTED)

REFACTORING STATUS:
- ✅ auth.py - COMPLETE (onboarding, profile, provider management)
- ✅ billing.py - COMPLETE (Stripe integration)
- ⏳ proxy.py - PENDING (main AI gateway logic)
- ⏳ management.py - PENDING (project/key CRUD)
"""

# Import existing routers
# CRITICAL: Graceful degradation - only import what exists
__all__ = []

try:
    from .auth import router as auth_router
    __all__.append("auth_router")
except ImportError as e:
    auth_router = None
    # Log warning in production
    import sys
    if 'pytest' not in sys.modules:
        print(f"Warning: auth router not available: {e}", file=sys.stderr)

try:
    from .team import router as team_router
    __all__.append("team_router")
except ImportError as e:
    team_router = None
    import sys
    if 'pytest' not in sys.modules:
        print(f"Warning: team router not available: {e}", file=sys.stderr)

try:
    from .proxy import router as proxy_router
    __all__.append("proxy_router")
except ImportError:
    proxy_router = None  # Not yet extracted from main.py

try:
    from .management import router as management_router
    __all__.append("management_router")
except ImportError:
    management_router = None  # Not yet extracted from main.py

try:
    from .billing import router as billing_router
    __all__.append("billing_router")
except ImportError as e:
    billing_router = None
    import sys
    if 'pytest' not in sys.modules:
        print(f"Warning: billing router not available: {e}", file=sys.stderr)

try:
    from .public import router as public_router
    __all__.append("public_router")
except ImportError as e:
    public_router = None
    import sys
    if 'pytest' not in sys.modules:
        print(f"Warning: public router not available: {e}", file=sys.stderr)

try:
    from .agents import router as agents_router
    __all__.append("agents_router")
except ImportError as e:
    agents_router = None
    import sys
    if 'pytest' not in sys.modules:
        print(f"Warning: agents router not available: {e}", file=sys.stderr)

try:
    from .mcp import router as mcp_router
    __all__.append("mcp_router")
except ImportError as e:
    mcp_router = None
    import sys
    if 'pytest' not in sys.modules:
        print(f"Warning: mcp router not available: {e}", file=sys.stderr)

