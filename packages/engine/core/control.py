"""
Centralized execution controls for agents/orgs.

Phase 1 scope:
- DB is the source of truth for status.
- Redis mirrors status/termination flags for fast reads.
- Best-effort streaming cancellation via session termination flag.
"""

from __future__ import annotations

import datetime
import json
from typing import Literal, Optional, TypedDict

from core import log, resources
from security_utils import log_error_safe

# Cache/flag TTLs
STATUS_CACHE_TTL_SECONDS = 300
SESSION_TERMINATED_TTL_SECONDS = 3600

AgentStatus = Literal["active", "suspended", "disabled"]
OrgStatus = Literal["active", "suspended"]


class ControlResult(TypedDict, total=False):
    """Return payload for control checks."""

    allowed: bool
    code: str
    message: str
    reason: Optional[str]
    suspended_until: Optional[str]
    status_code: int


def _parse_ts(value: object) -> Optional[datetime.datetime]:
    """Parse timestamps (string or datetime) safely."""
    if not value:
        return None
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=datetime.timezone.utc)
        return value
    try:
        # Allow ISO strings with or without Z
        text = str(value)
        if text.endswith("Z"):
            text = text.replace("Z", "+00:00")
        return datetime.datetime.fromisoformat(text)
    except Exception:
        return None


def _normalize_agent_status(raw_status: Optional[str], legacy_paused: bool | None, legacy_archived: bool | None) -> AgentStatus:
    status = (raw_status or "active").lower()
    if status == "paused" or legacy_paused:
        status = "suspended"
    if status == "archived" or legacy_archived:
        status = "disabled"
    if status not in ("active", "suspended", "disabled"):
        status = "active"
    return status  # type: ignore[return-value]


def _normalize_org_status(raw_status: Optional[str], legacy_paused: bool | None) -> OrgStatus:
    status = (raw_status or "active").lower()
    if status == "paused" or legacy_paused:
        status = "suspended"
    if status not in ("active", "suspended"):
        status = "active"
    return status  # type: ignore[return-value]


async def _cache_status(kind: str, entity_id: str, payload: dict, ttl_seconds: int = STATUS_CACHE_TTL_SECONDS) -> None:
    """Store status payload in Redis (best effort)."""
    if not resources.redis:
        return
    try:
        await resources.redis.setex(f"oxy:{kind}:{entity_id}:status", ttl_seconds, json.dumps(payload))
    except Exception as e:
        log_error_safe(log, f"{kind}_status_cache_failed", e, entity_id=entity_id)


async def _get_cached_status(kind: str, entity_id: str) -> Optional[dict]:
    """Fetch cached status payload from Redis."""
    if not resources.redis:
        return None
    try:
        raw = await resources.redis.get(f"oxy:{kind}:{entity_id}:status")
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            # Legacy plain-string payloads fallback to status only
            return {"status": raw}
    except Exception as e:
        log_error_safe(log, f"{kind}_status_cache_lookup_failed", e, entity_id=entity_id)
        return None


async def get_org_status(org_id: str) -> dict:
    """Get organization status (DB is authority, Redis cache is hint)."""
    cached = None if resources.supabase else await _get_cached_status("org", org_id)
    if cached:
        return cached

    status_payload = {"status": "active", "suspended_until": None, "reason": None}

    if not resources.supabase:
        return status_payload

    try:
        select_clause = "status,suspended_until,suspend_reason,paused,last_paused_at,last_pause_reason"
        try_clauses = [select_clause, "status,paused"]

        last_error = None
        for clause in try_clauses:
            try:
                query = (
                    resources.supabase.table("organizations")
                    .select(clause)
                    .eq("id", org_id)
                )
                res_obj = query.single().execute() if hasattr(query, "single") else query.execute()
                res = await res_obj if hasattr(res_obj, "__await__") else res_obj
                data = res.data or []
                row = data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else {})
                status_payload["status"] = _normalize_org_status(row.get("status"), row.get("paused"))
                status_payload["suspended_until"] = row.get("suspended_until") or row.get("last_paused_at")
                status_payload["reason"] = row.get("suspend_reason") or row.get("last_pause_reason")
                last_error = None
                break
            except Exception as inner_e:
                last_error = inner_e
                log.warning("org_status_lookup_fallback", select_clause=clause, error=str(inner_e)[:200])
        if last_error:
            raise last_error
    except Exception as e:
        log_error_safe(log, "org_status_lookup_failed", e, organization_id=org_id)

    await _cache_status("org", org_id, status_payload)
    return status_payload


async def get_agent_status(agent_id: str) -> dict:
    """Get agent status (DB authority, Redis cache is hint)."""
    cached = None if resources.supabase else await _get_cached_status("agent", agent_id)
    if cached:
        return cached

    status_payload = {"status": "active", "suspended_until": None, "reason": None}

    if not resources.supabase:
        return status_payload

    try:
        query = (
            resources.supabase.table("agents")
            .select(
                "status,suspended_until,suspend_reason,suspend_on_anomaly,anomaly_suspend_duration_minutes,"
                "auto_suspend_on_loop,loop_suspend_duration_minutes"
            )
            .eq("id", agent_id)
        )
        res_obj = query.single().execute() if hasattr(query, "single") else query.execute()
        res = await res_obj if hasattr(res_obj, "__await__") else res_obj
        data = res.data or []
        row = data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else {})
        status_payload["status"] = _normalize_agent_status(
            row.get("status"),
            legacy_paused=None,
            legacy_archived=None,
        )
        status_payload["suspended_until"] = row.get("suspended_until")
        status_payload["reason"] = row.get("suspend_reason")
    except Exception as e:
        log_error_safe(log, "agent_status_lookup_failed", e, agent_id=agent_id)

    await _cache_status("agent", agent_id, status_payload)
    return status_payload


class ControlUnavailable(Exception):
    """Neither Redis nor the database could say whether a request may run.

    The request path refuses the request (503) rather than guess: the kill switch
    and the budget fail closed.
    """


async def is_session_terminated(session_id: Optional[str]) -> bool:
    """The kill flag for a session in Redis.

    Fails closed: when Redis cannot answer this raises ControlUnavailable instead
    of answering "not terminated". The caller either asks the database (the
    agent_sessions row is the authority) or refuses the request.
    """
    if not session_id:
        return False
    if not resources.redis:
        return False  # no Redis configured (offline tests): no flag can have been set
    keys = [
        f"oxy:session:{session_id}:terminated",
        f"agent_kill:{session_id}",  # Legacy compatibility
    ]
    try:
        for key in keys:
            flag = await resources.redis.get(key)
            if flag:
                return True
    except Exception as e:
        log_error_safe(log, "session_termination_lookup_failed", e, session_id=session_id)
        raise ControlUnavailable("kill flag unreadable") from e
    return False


async def mark_session_terminated(session_id: str, ttl_seconds: int = SESSION_TERMINATED_TTL_SECONDS) -> None:
    """Set termination flag for a session (both new and legacy keys)."""
    if not resources.redis:
        return
    try:
        await resources.redis.setex(f"oxy:session:{session_id}:terminated", ttl_seconds, "1")
        # Legacy key for backward compatibility
        await resources.redis.setex(f"agent_kill:{session_id}", ttl_seconds, "1")
    except Exception as e:
        log_error_safe(log, "session_termination_flag_failed", e, session_id=session_id)


async def cache_org_status(org_id: str, payload: dict) -> None:
    """Explicitly cache org status after mutations."""
    await _cache_status("org", org_id, payload)


async def cache_agent_status(agent_id: str, payload: dict) -> None:
    """Explicitly cache agent status after mutations."""
    await _cache_status("agent", agent_id, payload)


async def check_execution_allowed(
    *,
    org_id: str,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> ControlResult:
    """
    Centralized execution gate for requests.

    Order:
    1) Org status
    2) Agent status
    3) Session termination flag
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    org_status = await get_org_status(org_id)
    org_state: str = org_status.get("status", "active")
    org_until = _parse_ts(org_status.get("suspended_until"))
    if org_state in ("suspended", "disabled") or (org_until and org_until > now):
        return {
            "allowed": False,
            "code": "org_suspended",
            "message": "This organization is suspended and cannot accept new requests.",
            "reason": org_status.get("reason"),
            "suspended_until": org_until.isoformat() if org_until else None,
            "status_code": 403,
        }

    if agent_id:
        agent_status = await get_agent_status(agent_id)
        agent_state: str = agent_status.get("status", "active")
        agent_until = _parse_ts(agent_status.get("suspended_until"))
        if agent_state in ("suspended", "disabled") or (agent_until and agent_until > now):
            code = "agent_suspended" if agent_state != "disabled" else "agent_disabled"
            message = (
                "This agent is suspended and cannot accept new requests."
                if agent_state != "disabled"
                else "This agent is disabled and cannot accept new requests."
            )
            return {
                "allowed": False,
                "code": code,
                "message": message,
                "reason": agent_status.get("reason"),
                "suspended_until": agent_until.isoformat() if agent_until else None,
                "status_code": 403,
            }

    if session_id:
        try:
            terminated = await is_session_terminated(session_id)
        except ControlUnavailable:
            return {
                "allowed": False,
                "code": "kill_switch_unavailable",
                "message": "The kill switch cannot be checked right now; the request is refused.",
                "status_code": 503,
            }
        if terminated:
            return {
                "allowed": False,
                "code": "session_terminated",
                "message": "This session was terminated by a kill switch.",
                "status_code": 409,
            }

    return {"allowed": True, "status_code": 200, "org_status": org_state}
