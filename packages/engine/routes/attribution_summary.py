import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core import resources, SUPABASE_URL, log
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1", tags=["attribution"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def _start_of_month() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def _parse_ts(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


async def _fetch_tag_map(org_id: str, key_filter: Optional[str]) -> Dict[str, Dict[str, Any]]:
    params = {
        "organization_id": f"eq.{org_id}",
        "select": "id,key,value,description,tag_type",
        "limit": "500",
    }
    if key_filter:
        params["key"] = f"eq.{key_filter}"
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/cost_attribution_tags",
            params=params,
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        data = res.json()
        return {row["id"]: row for row in data}
    except Exception as e:
        log.error("attribution_tags_fetch_failed", org_id=org_id, error=str(e))
        return {}


async def _fetch_attribution_rows(
    org_id: str,
    start: datetime,
    end: datetime,
    limit: int,
    tag_ids: Optional[List[str]],
) -> List[Dict[str, Any]]:
    # PostgREST accepts repeated parameters for combining filters on the same
    # column (lower + upper bound here). httpx serialises a list of tuples
    # into the right repeated-key URL form, so we use that shape instead of
    # a dict (which can't hold duplicate keys) or the `and=(...)` form (which
    # mis-parses ISO timestamps containing `:` and `+`).
    params: list[tuple[str, str]] = [
        ("organization_id", f"eq.{org_id}"),
        ("created_at", f"gte.{start.isoformat()}"),
        ("created_at", f"lte.{end.isoformat()}"),
        ("select", "tag_id,total_cost_usd:cost_usd.sum(),request_count:id.count()"),
        # ORDER BY removed: PostgREST 12 rejects sorting on aliased aggregates
        # with "column must appear in GROUP BY". Sort client-side after fetch.
        ("limit", str(limit)),
    ]
    if tag_ids:
        params.append(("tag_id", f"in.({','.join(tag_ids)})"))
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/request_attribution",
            params=params,
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json() or []
        rows.sort(key=lambda r: float(r.get("total_cost_usd") or 0), reverse=True)
        return rows
    except Exception as e:
        log.error("attribution_rows_fetch_failed", org_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch attribution summary") from e


@router.get("/attribution/summary")
async def attribution_summary(
    from_ts: Optional[str] = Query(None, alias="from"),
    to_ts: Optional[str] = Query(None, alias="to"),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    key: Optional[str] = Query(None, description="Optional tag key filter (e.g., customer_id, team)"),
    key_data: CacheData = Depends(api_key_dependency),
):
    """
    Cost attribution summary grouped by cost attribution tags.
    Defaults to month-to-date if no time range is provided.
    """
    org_id = key_data["organization_id"]
    start = _parse_ts(from_ts) or _start_of_month()
    end = _parse_ts(to_ts) or datetime.now(timezone.utc)

    tag_map = await _fetch_tag_map(org_id, key)
    tag_ids = list(tag_map.keys()) if key else None

    rows = await _fetch_attribution_rows(org_id, start, end, limit, tag_ids)

    items = []
    for r in rows:
        tag_id = r.get("tag_id")
        tag_info = tag_map.get(tag_id, {}) if tag_map else {}
        total_cost = float(r.get("total_cost_usd") or 0)
        count = int(r.get("request_count") or 0)
        items.append(
            {
                "tag": tag_info.get("key") and f"{tag_info.get('key')}:{tag_info.get('value')}" or tag_id,
                "label": tag_info.get("description") or tag_info.get("value") or tag_id,
                "tag_id": tag_id,
                "tag_key": tag_info.get("key"),
                "tag_value": tag_info.get("value"),
                "tag_type": tag_info.get("tag_type"),
                "total_cost_usd": round(total_cost, 4),
                "request_count": count,
                "avg_cost_usd": round(total_cost / count, 6) if count else 0,
                "model_breakdown": [],
            }
        )

    # Sort defensively and truncate
    items = sorted(items, key=lambda x: x["total_cost_usd"], reverse=True)[:limit]

    return {
        "attribution_key": key or "cost_tag",
        "from": start.isoformat(),
        "to": end.isoformat(),
        "items": items,
    }

