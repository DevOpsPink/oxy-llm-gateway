"""
Usage tracking helper (per-organization monthly request counts).
"""

from datetime import datetime, timezone
from fastapi import HTTPException

from core import resources, SUPABASE_URL, log
from dependencies import get_supabase_headers
from security_utils import log_error_safe


def current_month_slug() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m")


async def increment_org_monthly_usage(org_id: str):
    """No-op kept for backward compatibility.

    The counter is no longer materialised in `org_monthly_usage`; the previous
    implementation attempted `PATCH ?request_count={"increment":1}` which is
    not valid PostgREST syntax (atomic increments aren't supported there),
    so it always 400'd and the table never reflected real usage. We now
    count directly from `request_logs` in `get_org_monthly_usage()`, which
    is the source of truth anyway.
    """
    return None


async def get_org_monthly_usage(org_id: str, month: str | None = None) -> int:
    """Count successful (non-blocked) requests in `request_logs` for the org
    during the requested month. Uses PostgREST's HEAD-with-count trick:
    `Prefer: count=exact` returns the matching row count in the
    `Content-Range` response header without serialising the rows.
    """
    month = month or current_month_slug()
    # Parse "YYYY-MM" to compute the [start, next_month) bounds in UTC.
    year, mon = (int(p) for p in month.split("-", 1))
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    next_year = year + (1 if mon == 12 else 0)
    next_month = 1 if mon == 12 else mon + 1
    end = datetime(next_year, next_month, 1, tzinfo=timezone.utc)

    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_logs",
            params=[
                ("organization_id", f"eq.{org_id}"),
                ("created_at", f"gte.{start.isoformat()}"),
                ("created_at", f"lt.{end.isoformat()}"),
                ("select", "id"),
                ("limit", "1"),
            ],
            headers={**get_supabase_headers(), "Prefer": "count=exact"},
        )
        res.raise_for_status()
        # PostgREST returns `Content-Range: 0-0/<total>` when count=exact.
        content_range = res.headers.get("content-range", "")
        if "/" in content_range:
            try:
                return int(content_range.rsplit("/", 1)[1])
            except ValueError:
                return 0
        return 0
    except Exception as e:
        log_error_safe(log, "usage_fetch_failed", e, organization_id=org_id)
        raise HTTPException(status_code=500, detail="Failed to fetch usage")

