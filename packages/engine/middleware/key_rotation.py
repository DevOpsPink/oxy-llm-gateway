"""
API key rotation middleware (best-effort hygiene, not auto-rotation).

Goals (Core 0.1 GA):
- Deterministic thresholds: warning vs. enforce.
- Configurable via env (or org policy later).
- Consistent headers: X-Oxy-Key-Rotation-Status/Age/Expires-In-Days.
- Default: warn-only; enforcement is opt-in.
"""

import os
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse
import structlog

log = structlog.get_logger()

DEFAULT_WARNING_DAYS = 80
DEFAULT_MAX_DAYS = 90
DEFAULT_MODE = "warn"  # off|warn|enforce
SKIP_PATHS = {"/health", "/metrics", "/management"}


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def _load_policy() -> Dict:
    return {
        "mode": os.getenv("KEY_ROTATION_MODE", DEFAULT_MODE).lower(),  # off|warn|enforce
        "warning_days": _env_int("KEY_ROTATION_WARNING_DAYS", DEFAULT_WARNING_DAYS),
        "max_days": _env_int("KEY_ROTATION_MAX_DAYS", DEFAULT_MAX_DAYS),
    }


def _evaluate_rotation_state(age_days: int, policy: Dict) -> Tuple[str, int]:
    """Return (state, days_to_max)."""
    warning_days = policy["warning_days"]
    max_days = policy["max_days"]
    days_to_max = max_days - age_days

    if age_days >= max_days:
        return "expired", 0
    if age_days >= warning_days:
        return "warning", days_to_max
    return "fresh", days_to_max


def _build_headers(state: str, age_days: int, days_to_max: int) -> Dict[str, str]:
    headers: Dict[str, str] = {
        "X-Oxy-Key-Rotation-Status": state,
        "X-Oxy-Key-Age-Days": str(age_days),
    }
    if state in {"warning", "expired"}:
        headers["X-Oxy-Key-Expires-In-Days"] = str(max(days_to_max, 0))
        headers["X-Oxy-Key-Rotation-URL"] = f"{os.getenv('SITE_URL', 'http://localhost:3000').rstrip('/')}/dashboard/api-keys"
    return headers


def _parse_iso(dt_str: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return None


async def key_rotation_middleware(request: Request, call_next):
    policy = _load_policy()
    mode = policy["mode"]

    if mode == "off":
        return await call_next(request)

    if request.url.path.startswith(tuple(SKIP_PATHS)):
        return await call_next(request)

    if not request.url.path.startswith("/v1/"):
        return await call_next(request)

    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer oxy_"):
        return await call_next(request)

    response = await call_next(request)

    key_id = getattr(request.state, "key_id", None)
    key_record = getattr(request.state, "key_rotation_record", None)

    try:
        if key_record is None and key_id:
            key_record = await _fetch_key_record(key_id)

        if not key_id or not key_record:
            return response

        reference_date_str = key_record.get("last_rotated_at") or key_record.get("created_at")
        if not reference_date_str:
            log.error("key_rotation_reference_date_missing", key_id=key_id)
            return response

        reference_date = _parse_iso(reference_date_str)
        if not reference_date:
            log.error("key_rotation_reference_date_invalid", key_id=key_id, reference_date=reference_date_str)
            return response

        age_days = (datetime.now(timezone.utc) - reference_date).days
        state, days_to_max = _evaluate_rotation_state(age_days, policy)

        if state == "expired" and mode == "enforce":
            headers = _build_headers(state, age_days, days_to_max)
            log.warn(
                "api_key_rotation_blocked",
                key_id=key_id,
                key_age_days=age_days,
                max_days=policy["max_days"],
                mode=mode,
            )
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "key_rotation_required",
                        "message": "API key must be rotated before further use.",
                        "key_age_days": age_days,
                        "max_age_days": policy["max_days"],
                        "mode": mode,
                    }
                },
                headers=headers,
            )

        if state in {"warning", "expired"}:
            headers = _build_headers(state, age_days, days_to_max)
            for k, v in headers.items():
                response.headers[k] = v
            return response

        return response

    except Exception as exc:
        log.error("key_rotation_check_failed", key_id=key_id, error=str(exc)[:200])
        return response


async def _fetch_key_record(key_id: str) -> Optional[Dict]:
    from core import resources
    from dependencies import get_supabase_headers

    res = await resources.http_client.get(
        f"{os.getenv('SUPABASE_URL')}/rest/v1/api_keys",
        params={
            "select": "id,created_at,key_name,last_rotated_at",
            "id": f"eq.{key_id}",
            "limit": "1",
        },
        headers=get_supabase_headers(),
        timeout=5.0,
    )
    res.raise_for_status()
    data = res.json()
    if not data:
        return None
    return data[0]
