import re
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from core import resources, SUPABASE_URL, log
from core.addons import require_add_on
from core.audit import log_admin_event
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/org", tags=["org"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)
SLUG_REGEX = re.compile(r"^[a-z0-9-]+$")


class OrgUpdateRequest(BaseModel):
    display_name: str | None = None
    slug: str | None = Field(default=None, description="Lowercase slug/handle")
    logo_url: str | None = None
    timezone: str | None = None
    locale: str | None = None
    support_email: str | None = None
    billing_email: str | None = None
    key_rotation_days: int | None = None
    key_rotation_enforcement_mode: str | None = None
    key_rotation_grace_days: int | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v):
        if v is None:
            return v
        if "/" not in v:
            raise ValueError("Invalid timezone format (expected Region/City)")
        return v

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v):
        if v is None:
            return v
        if not re.match(r"^[a-z]{2}(-[A-Z]{2})?$", v):
            raise ValueError("Invalid locale format (e.g., en or en-US)")
        return v

    @field_validator("support_email", "billing_email")
    @classmethod
    def validate_email(cls, v):
        if v is None or v == "":
            return None
        if "@" not in v:
            raise ValueError("Invalid email")
        return v.strip().lower()

    @field_validator("key_rotation_days")
    @classmethod
    def validate_rotation_days(cls, v):
        if v is None:
            return v
        if v < 1 or v > 365:
            raise ValueError("key_rotation_days must be between 1 and 365")
        return v

    @field_validator("key_rotation_grace_days")
    @classmethod
    def validate_grace_days(cls, v):
        if v is None:
            return v
        if v < 0 or v > 365:
            raise ValueError("key_rotation_grace_days must be between 0 and 365")
        return v

    @field_validator("key_rotation_enforcement_mode")
    @classmethod
    def validate_mode(cls, v):
        if v is None:
            return v
        if v not in {"off", "warn", "enforce"}:
            raise ValueError("key_rotation_enforcement_mode must be off|warn|enforce")
        return v


async def _fetch_org(org_id: str) -> Dict[str, Any]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organizations",
        params={
            "id": f"eq.{org_id}",
            "select": "id,name,display_name,slug,logo_url,timezone,locale,support_email,billing_email,key_rotation_days,key_rotation_enforcement_mode,key_rotation_grace_days",
            "limit": 1,
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Organization not found")
    return rows[0]


@router.get("")
async def get_org(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    return await _fetch_org(org_id)


@router.post("")
async def update_org(
    body: OrgUpdateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]

    # Route-level slug validation to return 400 instead of Pydantic 422
    if body.slug is not None and not SLUG_REGEX.match(body.slug):
        raise HTTPException(status_code=400, detail="Invalid slug")

    current = await _fetch_org(org_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return current
    try:
        # White-label gating: logo updates require add-on
        if "logo_url" in updates:
            await require_add_on(
                org_id,
                "white_label",
                "Branding updates require the white-label add-on.",
            )

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
        updated = rows[0]
        try:
            await log_admin_event(
                organization_id=org_id,
                event_type="org.updated",
                actor_id=user_id,
                actor_type="api_key",
                metadata={"old": current, "new": {k: updated.get(k) for k in updates.keys()}},
            )
        except Exception:
            pass
        return updated
    except HTTPException:
        raise
    except Exception as e:
        log.error("org_update_failed", organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update organization")

