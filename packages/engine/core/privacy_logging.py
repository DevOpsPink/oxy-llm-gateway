"""
Centralized privacy-aware logging sanitizer.

Modes:
- zero_prompt_logging: drop all raw text; keep minimal metadata only.
- metadata_only: drop raw text; keep sizes/timings/metadata.
- debug_full: may store text only if debug logging is explicitly allowed.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

def _debug_full_allowed_env() -> bool:
    return os.getenv("OXY_DEBUG_FULL_LOGS", "false").lower() in ("1", "true", "yes")

DEBUG_FULL_ALLOWED = _debug_full_allowed_env()

PRIVACY_MODES = {"zero_prompt_logging", "metadata_only", "debug_full"}
DEFAULT_MODE = "metadata_only"


def sanitize_event_for_logging(
    *,
    privacy_mode: Optional[str],
    event: Dict[str, Any],
    debug_full_allowed: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Return a payload safe to persist based on privacy_mode.

    The event may contain:
    - prompt_text, response_text (optional, may be None)
    - token counts, timing, ids, model/provider, status, cost_tags, etc.
    """
    mode = privacy_mode if privacy_mode in PRIVACY_MODES else DEFAULT_MODE
    allow_debug = _debug_full_allowed_env() if debug_full_allowed is None else debug_full_allowed

    payload = {k: v for k, v in event.items() if k not in ("prompt_text", "response_text")}
    payload["privacy_mode"] = mode

    if mode == "debug_full" and allow_debug:
        # Store text as-is (respect explicit debug allowance)
        payload["prompt_snapshot"] = event.get("prompt_text")
        payload["response_snapshot"] = event.get("response_text")
    else:
        # Always drop raw text in zero_prompt_logging/metadata_only
        payload["prompt_snapshot"] = None
        payload["response_snapshot"] = None

    # Ensure no stray raw fields remain
    payload.pop("prompt_text", None)
    payload.pop("response_text", None)

    return payload
