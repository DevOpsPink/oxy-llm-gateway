"""
Request/audit log retention worker (best-effort, policy-driven).
Deletes request_logs older than the per-org retention window.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional

from core import resources, SUPABASE_URL, log
from core.addons import get_org_add_ons, compute_retention_days
from dependencies import get_supabase_headers

DEFAULT_RETENTION_DAYS = 365
MIN_RETENTION_DAYS = 7
MAX_RETENTION_DAYS = 2555  # ~7 years; upper bound, not a guarantee
ADDON_RETENTION_DAYS = int(os.getenv("ADDON_AUDIT_LOG_RETENTION_DAYS", "1825"))


def _clamp_days(days: Optional[int]) -> int:
    try:
        if days is None:
            return DEFAULT_RETENTION_DAYS
        return max(MIN_RETENTION_DAYS, min(MAX_RETENTION_DAYS, int(days)))
    except Exception:
        return DEFAULT_RETENTION_DAYS


def build_retention_params(org_id: str, days: int) -> Dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return {
        "organization_id": f"eq.{org_id}",
        "created_at": cutoff.isoformat(),
    }


async def run_log_retention(orgs: List[Dict[str, Any]]):
    """
    Accepts a list of org records containing id and request_log_retention_days.
    Executes per-org deletion of old request_logs.
    """
    for org in orgs:
        org_id = org.get("id")
        base_days = _clamp_days(org.get("request_log_retention_days"))
        try:
            addons = await get_org_add_ons(org_id)
            has_audit_addon = "audit_logs" in addons
            days = compute_retention_days(
                base_days=base_days,
                has_audit_addon=has_audit_addon,
                addon_days=ADDON_RETENTION_DAYS,
                min_days=MIN_RETENTION_DAYS,
                max_days=MAX_RETENTION_DAYS,
            )
            params = build_retention_params(org_id, days)
            client = getattr(resources, "http_client_for_deletes", None) or resources.http_client
            await client.delete(
                f"{SUPABASE_URL}/rest/v1/request_logs",
                params=params,
                headers=get_supabase_headers(),
            )
            log.info("log_retention_run", organization_id=org_id, retention_days=days, audit_addon=has_audit_addon)
        except Exception as e:
            log.error("log_retention_failed", organization_id=org_id, error=str(e))

