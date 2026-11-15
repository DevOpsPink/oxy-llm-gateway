from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core import resources, SUPABASE_URL
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/audit", tags=["audit"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def _parse_ts(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


@router.get("/logs")
async def list_audit_logs(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    event_type: Optional[str] = Query(None),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    since_dt = _parse_ts(since) or (datetime.now(timezone.utc) - timedelta(days=30))
    until_dt = _parse_ts(until) or datetime.now(timezone.utc)

    # PostgREST needs duplicate-key params (not `created_at.lte=lte.X` which
    # it treats as the literal column name `created_at.lte`); httpx serialises
    # a list of tuples into the right repeated-key URL shape.
    params: list[tuple[str, str]] = [
        ("organization_id", f"eq.{org_id}"),
        ("created_at", f"gte.{since_dt.isoformat()}"),
        ("created_at", f"lte.{until_dt.isoformat()}"),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    if event_type:
        params.append(("event_type", f"eq.{event_type}"))
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/admin_audit_logs",
            params=params,
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        return {"events": res.json()}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch audit logs") from e

