"""
Helpers for organization add-ons (single source of truth).
"""

from __future__ import annotations

from decimal import Decimal
from typing import List, Set

from fastapi import HTTPException

from core import resources, SUPABASE_URL, log
from dependencies import get_supabase_headers

ADD_ON_IDS = {
    "sso",
    "white_label",
    "dedicated_support",
    "audit_logs",
    "extra_project",
}


async def get_org_add_ons(org_id: str) -> Set[str]:
    """
    Return active add-on ids for an organization.
    """
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_add_ons",
            params={
                "organization_id": f"eq.{org_id}",
                "canceled_at": "is.null",
                "select": "add_on_id",
            },
            headers=get_supabase_headers(),
            timeout=5.0,
        )
        res.raise_for_status()
        data: List[dict] = res.json() or []
        return {row.get("add_on_id") for row in data if row.get("add_on_id") in ADD_ON_IDS}
    except Exception as exc:
        log.error("get_org_add_ons_failed", org_id=org_id, error=str(exc))
        return set()


async def require_add_on(org_id: str, add_on_id: str, detail: str) -> None:
    addons = await get_org_add_ons(org_id)
    if add_on_id not in addons:
        raise HTTPException(status_code=403, detail=detail)


def compute_project_limit(tier_limit: int, has_extra: bool, increment: int, hard_max: int) -> int:
    """
    Compute project cap with optional add-on increment, clamped to hard max.
    """
    base = min(tier_limit, hard_max)
    if not has_extra:
        return base
    return min(hard_max, base + increment)


def compute_retention_days(
    base_days: int,
    has_audit_addon: bool,
    addon_days: int,
    min_days: int,
    max_days: int,
) -> int:
    """
    Compute retention window with optional audit add-on, clamped to bounds.
    """
    target = addon_days if has_audit_addon else base_days
    return max(min_days, min(max_days, target))
