"""
Guardrails API: kill switch and auto-suspend settings per organization.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import resources
from core.control import cache_org_status
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key
from core.audit import log_admin_event

router = APIRouter(prefix="/v1", tags=["guardrails"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)


class GuardrailsUpdate(BaseModel):
    paused: bool | None = None
    auto_suspend_on_cost_spikes: bool | None = None


def _get_org_guardrails(org_id: str):
    result = (
        resources.supabase.table("organizations")
        .select(
            "status, suspended_until, suspend_reason, paused, auto_suspend_on_cost_spikes, last_paused_at, last_pause_reason"
        )
        .eq("id", org_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Organization not found")
    return rows[0]


@router.get("/guardrails")
async def get_guardrails(
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    return _get_org_guardrails(org_id)


@router.post("/guardrails")
async def update_guardrails(
    payload: GuardrailsUpdate,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    current = _get_org_guardrails(org_id)

    updates = {}
    if payload.paused is not None:
        updates["paused"] = payload.paused
        updates["status"] = "suspended" if payload.paused else "active"
        updates["suspended_until"] = None
        updates["suspend_reason"] = "manual_toggle" if payload.paused else None
        updates["last_paused_at"] = datetime.now(timezone.utc).isoformat() if payload.paused else None
        updates["last_pause_reason"] = "manual_toggle" if payload.paused else None
    if payload.auto_suspend_on_cost_spikes is not None:
        updates["auto_suspend_on_cost_spikes"] = payload.auto_suspend_on_cost_spikes

    if not updates:
        return _get_org_guardrails(org_id)

    try:
        resources.supabase.table("organizations").update(updates).eq("id", org_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update guardrails") from e

    new_state = _get_org_guardrails(org_id)
    # Best-effort cache refresh so the control hook sees the change immediately
    try:
        await cache_org_status(
            org_id,
            {
                "status": new_state.get("status", "active"),
                "suspended_until": new_state.get("suspended_until"),
                "reason": new_state.get("suspend_reason") or new_state.get("last_pause_reason"),
            },
        )
    except Exception:
        pass
    # Best-effort audit log
    try:
        await log_admin_event(
            organization_id=org_id,
            event_type="guardrails.updated",
            actor_id=key_data.get("user_id"),
            actor_type="api_key",
            metadata={
                "paused": {"old": current.get("paused"), "new": new_state.get("paused")},
                "auto_suspend_on_cost_spikes": {
                    "old": current.get("auto_suspend_on_cost_spikes"),
                    "new": new_state.get("auto_suspend_on_cost_spikes"),
                },
            },
        )
    except Exception:
        pass

    return new_state

