import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from core import resources, SUPABASE_URL, log
from core.audit import log_admin_event
from core.control import mark_session_terminated
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/agent-sessions", tags=["agent-sessions"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def _parse_status(status: Optional[str]) -> Optional[str]:
    if not status:
        return None
    allowed = {"pending", "running", "completed", "failed", "cancelled", "timeout", "killed"}
    return status if status in allowed else None


def _session_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "status": row.get("status"),
        "session_type": row.get("session_type"),
        "agent_id": row.get("agent_id"),
        "model": (row.get("metadata") or {}).get("model"),
        "started_at": row.get("started_at"),
        "last_activity_at": row.get("ended_at") or row.get("started_at"),
        "total_requests": row.get("total_requests", 0),
        "total_tokens": row.get("total_tokens", 0),
        "total_cost_usd": float(row.get("total_cost", 0) or 0),
        "loop_detected": (row.get("metadata") or {}).get("loop_detected", False),
        "anomaly_flags": (row.get("metadata") or {}).get("anomaly_flags", []),
        "last_error": row.get("error_message"),
        "last_event": (row.get("metadata") or {}).get("last_event"),
    }


@router.get("")
async def list_agent_sessions(
    status: Optional[str] = Query(None),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    status_val = _parse_status(status)
    params = {
        "organization_id": f"eq.{org_id}",
        "select": "id,status,session_type,agent_id,started_at,ended_at,total_requests,total_tokens,total_cost,error_message,metadata",
        "order": "started_at.desc",
        "limit": str(limit),
    }
    if status_val:
        params["status"] = f"eq.{status_val}"
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/agent_sessions",
            params=params,
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json() or []
        return {"sessions": [_session_to_api(r) for r in rows]}
    except Exception as e:
        log.error("agent_sessions_list_failed", organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list agent sessions")


@router.get("/{session_id}")
async def get_agent_session(
    session_id: str,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/agent_sessions",
            params={
                "id": f"eq.{session_id}",
                "organization_id": f"eq.{org_id}",
                "select": "id,status,session_type,agent_id,started_at,ended_at,total_requests,total_tokens,total_cost,error_message,metadata",
                "limit": "1",
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json() or []
        if not rows:
            raise HTTPException(status_code=404, detail="Session not found")
        session = _session_to_api(rows[0])

        # Fetch recent requests for timeline
        timeline_res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params={
                "agent_session_id": f"eq.{session_id}",
                "select": "id,created_at,model,provider,status,cost_usd",
                "order": "created_at.desc",
                "limit": "20",
            },
            headers=get_supabase_headers(),
        )
        timeline_res.raise_for_status()
        session["timeline"] = timeline_res.json() or []
        return session
    except HTTPException:
        raise
    except Exception as e:
        log.error("agent_session_get_failed", session_id=session_id, organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch session")


@router.post("/{session_id}/kill")
async def kill_agent_session(
    session_id: str,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found or already stopped")
    try:
        # The session must belong to this key's organization before anything is killed.
        owned = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/agent_sessions",
            headers=get_supabase_headers(),
            params={"select": "id", "id": f"eq.{session_id}", "organization_id": f"eq.{org_id}", "limit": "1"},
        )
        owned.raise_for_status()
        if not owned.json():
            raise HTTPException(status_code=404, detail="Session not found or already stopped")
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_kill_agent_session",
            headers=get_supabase_headers(),
            json={"p_session_id": session_id, "p_user_id": user_id, "p_reason": "manual_kill"},
        )
        res.raise_for_status()
        success = bool(res.json())
        if not success:
            raise HTTPException(status_code=404, detail="Session not found or already stopped")
        # The gateway checks the session flag in Redis on every request; the database
        # row alone did not stop anything.
        await mark_session_terminated(session_id)
        try:
            await log_admin_event(
                organization_id=org_id,
                event_type="agent_session.killed",
                actor_id=user_id,
                actor_type="api_key",
                metadata={"session_id": session_id, "reason": "manual_kill"},
            )
        except Exception:
            pass
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        log.error("agent_session_kill_failed", session_id=session_id, organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to kill session")

