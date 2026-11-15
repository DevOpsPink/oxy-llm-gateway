"""
ADD-ONS
=======
Per-organization feature flags: rows in organization_add_ons (one per
add_on_id, canceled_at empty), read by core/addons.py. The operator turns a
flag on by inserting that row; nothing here sells, buys or bills anything.
docs/features/add-ons.md lists what each flag changes.

Add-ons:
- sso: SSO / SAML authentication
- extra_project: extra project slots
- white_label: organization logo in the dashboard
- dedicated_support: a label only (changes no behavior)
- audit_logs: longer request-log retention

License: Apache 2.0
"""

import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core import log, resources
from core.addons import get_org_add_ons
from dependencies import get_current_user_id, get_supabase_headers

SUPABASE_URL = os.getenv("SUPABASE_URL")

router = APIRouter(prefix="/add-ons", tags=["add-ons"])


ADD_ONS_CATALOG = {
    "sso": {
        "id": "sso",
        "name": "SSO / SAML Authentication",
        "description": "Single sign-on with SAML 2.0 for the organization's email domain.",
        "checked_by": "POST /auth/sso/configure",
    },
    "extra_project": {
        "id": "extra_project",
        "name": "Additional Project Slot",
        "description": "Raise the project cap by EXTRA_PROJECT_ADDON_INCREMENT (bounded by PROJECT_HARD_MAX).",
        "checked_by": "project creation",
    },
    "white_label": {
        "id": "white_label",
        "name": "Organization Logo",
        "description": "Lets the organization set its own logo in the dashboard.",
        "checked_by": "POST /v1/org",
    },
    "dedicated_support": {
        "id": "dedicated_support",
        "name": "Support Channel Label",
        "description": "A label for operators who run their own support tier. It changes no behavior.",
        "checked_by": "nothing",
    },
    "audit_logs": {
        "id": "audit_logs",
        "name": "Extended Request-Log Retention",
        "description": "Request-log retention from ADDON_AUDIT_LOG_RETENTION_DAYS (clamped to 7-2555 days).",
        "checked_by": "log retention worker",
    },
}


class AddOnFlag(BaseModel):
    """One feature flag and whether it is on for the organization asked about."""
    id: str
    name: str
    description: str
    checked_by: str
    enabled: bool = False


async def _is_active_member(user_id: str, organization_id: str) -> bool:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organization_members",
        params={
            "select": "user_id",
            "user_id": f"eq.{user_id}",
            "organization_id": f"eq.{organization_id}",
            "status": "eq.active",
            "limit": "1",
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    return bool(res.json())


@router.get("/catalog", response_model=List[AddOnFlag])
async def list_add_ons(
    organization_id: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    """
    The feature flags, each with `enabled` for `organization_id` when the caller
    is an active member of it (all off without one).
    """
    enabled: set[str] = set()
    if organization_id:
        try:
            uuid.UUID(organization_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="organization_id must be a UUID")
        try:
            if not await _is_active_member(user_id, organization_id):
                raise HTTPException(status_code=404, detail="Organization not found")
            enabled = await get_org_add_ons(organization_id)
        except HTTPException:
            raise
        except Exception as e:
            log.error("list_add_ons_failed", user_id=user_id, error=str(e)[:200])
            raise HTTPException(status_code=500, detail="Failed to fetch add-ons")
    return [AddOnFlag(**addon, enabled=addon["id"] in enabled) for addon in ADD_ONS_CATALOG.values()]
