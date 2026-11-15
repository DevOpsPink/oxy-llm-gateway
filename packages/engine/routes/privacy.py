from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import resources, SUPABASE_URL, log
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers, require_org_admin
from core.audit import log_admin_event

router = APIRouter(prefix="/v1/privacy", tags=["privacy"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

ALLOWED_MODES = {"zero_prompt_logging", "metadata_only", "debug_full"}
MIN_RETENTION = 7
MAX_RETENTION = 2555


class PrivacyResponse(BaseModel):
    privacy_mode: str
    request_log_retention_days: int


class PrivacyUpdateRequest(BaseModel):
    privacy_mode: str | None = Field(default=None)
    request_log_retention_days: int | None = Field(default=None)


async def _fetch_org(org_id: str) -> dict:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organizations",
        params={"id": f"eq.{org_id}", "select": "privacy_mode,request_log_retention_days", "limit": 1},
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Organization not found")
    return rows[0]


@router.get("", response_model=PrivacyResponse)
async def get_privacy_settings(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    data = await _fetch_org(org_id)
    return PrivacyResponse(
        privacy_mode=data.get("privacy_mode", "metadata_only"),
        request_log_retention_days=data.get("request_log_retention_days", 365),
    )


@router.post("", response_model=PrivacyResponse)
async def update_privacy_settings(
    body: PrivacyUpdateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    await require_org_admin(key_data)
    org_id = key_data["organization_id"]
    current = await _fetch_org(org_id)
    updates = {}

    if body.privacy_mode is not None:
        if body.privacy_mode not in ALLOWED_MODES:
            raise HTTPException(status_code=400, detail="Invalid privacy_mode")
        updates["privacy_mode"] = body.privacy_mode

    if body.request_log_retention_days is not None:
        val = max(MIN_RETENTION, min(MAX_RETENTION, body.request_log_retention_days))
        updates["request_log_retention_days"] = val

    if not updates:
        data = current
        return PrivacyResponse(
            privacy_mode=data.get("privacy_mode", "metadata_only"),
            request_log_retention_days=data.get("request_log_retention_days", 365),
        )

    try:
        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={"id": f"eq.{org_id}"},
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=updates,
        )
        res.raise_for_status()
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Organization not found")
        row = rows[0]
        try:
            await log_admin_event(
                organization_id=org_id,
                event_type="privacy.updated",
                actor_id=key_data.get("user_id"),
                actor_type="api_key",
                metadata={
                    "privacy_mode": {"old": current.get("privacy_mode"), "new": row.get("privacy_mode")},
                    "request_log_retention_days": {
                        "old": current.get("request_log_retention_days"),
                        "new": row.get("request_log_retention_days"),
                    },
                },
            )
        except Exception:
            pass
        return PrivacyResponse(
            privacy_mode=row.get("privacy_mode", "metadata_only"),
            request_log_retention_days=row.get("request_log_retention_days", 365),
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error("privacy_update_failed", organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update privacy settings")

