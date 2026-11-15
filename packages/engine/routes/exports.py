import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from core import resources
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key

router = APIRouter(prefix="/v1", tags=["exports"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

MAX_ROWS = 50_000
DEFAULT_RANGE_DAYS = 30


def _parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


@router.get("/exports/requests.csv")
async def export_requests_csv(
    from_ts: Optional[str] = Query(None, alias="from"),
    to_ts: Optional[str] = Query(None, alias="to"),
    model: Optional[str] = None,
    provider: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(10_000, ge=1, le=MAX_ROWS),
    key_data: CacheData = Depends(api_key_dependency),
):
    """
    CSV export of request logs for audits/compliance.
    Retention (long-term, policy-driven; up to several years where configured) is handled operationally; this exports whatever is stored.
    """
    org_id = key_data["organization_id"]
    to_dt = _parse_iso(to_ts) or datetime.now(timezone.utc)
    from_dt = _parse_iso(from_ts) or (to_dt - timedelta(days=DEFAULT_RANGE_DAYS))

    # Build query
    query = (
        resources.supabase.table("request_logs")
        .select(
            "id,created_at,provider,model,status,latency_ms,prompt_tokens,completion_tokens,total_tokens,cost_usd,project_id"
        )
        .eq("organization_id", org_id)
        .gte("created_at", from_dt.isoformat())
        .lte("created_at", to_dt.isoformat())
        .order("created_at", desc=True)
        .limit(limit)
    )
    if model:
        query = query.eq("model", model)
    if provider:
        query = query.eq("provider", provider)
    if status:
        query = query.eq("status", status)

    try:
        result = await query.execute()
        rows = result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch logs for export") from e

    # Generate CSV in-memory (bounded by MAX_ROWS)
    output = io.StringIO()
    writer = csv.writer(output)
    header = [
        "id",
        "created_at",
        "provider",
        "model",
        "status",
        "latency_ms",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "cost_usd",
        "project_id",
    ]
    writer.writerow(header)
    for r in rows:
        writer.writerow(
            [
                r.get("id", ""),
                r.get("created_at", ""),
                r.get("provider", ""),
                r.get("model", ""),
                r.get("status", ""),
                r.get("latency_ms", ""),
                r.get("prompt_tokens", ""),
                r.get("completion_tokens", ""),
                r.get("total_tokens", ""),
                r.get("cost_usd", ""),
                r.get("project_id", ""),
            ]
        )

    filename = f"oxy-requests-{datetime.now(timezone.utc).date()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )

