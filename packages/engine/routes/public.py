"""
Public API Routes (No Authentication Required)
===============================================

These endpoints are designed for:
1. Health checks
2. Public discovery (feature list)

SECURITY:
- No sensitive data exposed
- Rate limited to prevent abuse

"""

from fastapi import APIRouter
from slowapi import Limiter
from slowapi.util import get_remote_address

# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/public", tags=["public"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/status")
async def public_status():
    """
    Liveness without authentication: the API process answers. It checks nothing
    else; GET /health reports Redis and the database as they are.
    """
    return {"status": "operational", "version": "1.0.0"}


@router.get("/features")
async def public_features():
    """
    Return the list of features and their status.
    """
    return {
        "core_features": [
            {
                "name": "Kill Switch",
                "description": "Stop any AI agent fast via a dedicated Redis-based kill signal (no formal SLA)",
                "status": "available"
            },
            {
                "name": "Per-Agent Budgets",
                "description": "Set spending limits per agent, project, or organization",
                "status": "available"
            },
            {
                "name": "DLP Scanner",
                "description": "Detect API keys, PII, and secrets in prompts and tool outputs",
                "status": "available"
            },
            {
                "name": "Local Model Support",
                "description": "Route to Ollama, vLLM, and self-hosted models",
                "status": "available"
            },
            {
                "name": "Agent Dashboard",
                "description": "Real-time monitoring of agent sessions and tool calls",
                "status": "available"
            },
            {
                "name": "MCP Integration",
                "description": "Register and secure Model Context Protocol servers",
                "status": "available"
            },
            {
                "name": "Streaming",
                "description": "Stream responses in real-time",
                "status": "coming_soon"
            },
            {
                "name": "Anomaly Detection",
                "description": "AI-powered detection of unusual agent behavior",
                "status": "coming_soon"
            }
        ],
        "providers_supported": [
            {"name": "OpenAI", "status": "available"},
            {"name": "Anthropic", "status": "available"},
            {"name": "Google Gemini", "status": "available"},
            {"name": "Ollama", "status": "available"},
            {"name": "vLLM", "status": "available"},
            {"name": "Azure OpenAI", "status": "coming_soon"}
        ]
    }

