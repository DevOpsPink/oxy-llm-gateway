"""
Request activity API (Read-only)

Returns recent request logs for the authenticated organization.
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from core import resources
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key

router = APIRouter(prefix="/v1", tags=["requests"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)


@router.get("/requests")
async def list_requests(
    limit: int = Query(100, ge=1, le=200, description="Max results (default 100, max 200)"),
    model: str | None = Query(None),
    provider: str | None = Query(None),
    status: str | None = Query(None),
    key_data: CacheData = Depends(api_key_dependency),
):
    """
    Return recent request logs for the caller's organization.
    Does NOT return raw prompts/responses (zero prompt logging).
    """
    organization_id = key_data["organization_id"]

    fields = [
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
    ]

    try:
        query = (
            resources.supabase.table("request_logs")
            .select(",".join(fields))
            .eq("organization_id", organization_id)
            .order("created_at", desc=True)
            .limit(limit)
        )

        if model:
            query = query.eq("model", model)
        if provider:
            query = query.eq("provider", provider)
        if status:
            query = query.eq("status", status)

        result = await query.execute()
        data = result.data or []

        return {"items": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch requests") from e

