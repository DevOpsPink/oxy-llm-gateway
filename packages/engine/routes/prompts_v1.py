from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core import resources, SUPABASE_URL, log
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/prompts", tags=["prompts"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

MAX_LIMIT = 100
DEFAULT_LIMIT = 20


class Prompt(BaseModel):
    id: str
    title: str
    description: str
    prompt_text: str
    category: str
    recommended_model: str
    estimated_cost_per_use: float
    tags: List[str] = []
    author_user_id: str
    author_name: str
    is_verified: bool = False
    is_premium: bool = False
    created_at: str
    updated_at: str


class PromptCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    content: str = Field(..., min_length=1)
    tags: Optional[List[str]] = Field(default=[])


class PromptUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    content: Optional[str] = Field(default=None, min_length=20)
    tags: Optional[List[str]] = Field(default=None)


async def _org_member_ids(org_id: str) -> List[str]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organization_members",
            params={
                "organization_id": f"eq.{org_id}",
                "select": "user_id",
                "status": "eq.active",
                "limit": "200",
            },
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        return [row["user_id"] for row in res.json()]
    except Exception as e:
        log.error("prompt_org_members_fetch_failed", org_id=org_id, error=str(e))
        return []


def _category_from_tags(tags: List[str]) -> str:
    if not tags:
        return "other"
    lower = [t.lower() for t in tags]
    mapping = {
        "customer_support": ["support", "customer", "cs"],
        "code_generation": ["code", "coding", "dev", "engineering"],
        "data_analysis": ["data", "analysis", "analytics"],
        "content_writing": ["content", "writing", "blog", "copy"],
        "translation": ["translate", "translation"],
        "summarization": ["summary", "summarize", "summarization"],
    }
    for cat, keys in mapping.items():
        if any(k in lower[0] for k in keys):
            return cat
    return "other"


def _prompt_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "title": row.get("title"),
        "description": row.get("description"),
        "prompt_text": row.get("prompt_text"),
        "category": row.get("category"),
        "recommended_model": row.get("recommended_model"),
        "estimated_cost_per_use": float(row.get("estimated_cost_per_use") or 0),
        "tags": row.get("variables") or [],
        "author_user_id": row.get("author_user_id"),
        "author_name": row.get("author_name"),
        "is_verified": row.get("is_verified", False),
        "is_premium": row.get("is_premium", False),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _allowed_prompt(row: Dict[str, Any], member_ids: List[str]) -> bool:
    # Allow if verified or authored by an org member
    if row.get("is_verified"):
        return True
    return row.get("author_user_id") in member_ids


@router.get("/")
async def list_prompts(
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    member_ids = await _org_member_ids(org_id)
    params = {
        "select": "*",
        "order": "usage_count.desc",
        "limit": str(limit * 3),  # fetch a bit more then filter
    }
    if search:
        params["or"] = f"(title.ilike.%{search}%,description.ilike.%{search}%,prompt_text.ilike.%{search}%)"
    if tag:
        # treat tag as category or variable
        params["category"] = f"eq.{tag}"
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/prompts",
            params=params,
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json()
        filtered = [r for r in rows if _allowed_prompt(r, member_ids)]
        filtered = filtered[:limit]
        return {"items": [_prompt_to_api(r) for r in filtered]}
    except Exception as e:
        log.error("prompts_list_failed", org_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list prompts")


@router.post("/", status_code=201)
async def create_prompt(
    body: PromptCreateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]
    name = body.name.strip()
    desc = (body.description or "").strip()
    tags = body.tags or []
    category = _category_from_tags(tags)
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "title": name,
        "description": desc or "Prompt created via Oxy Prompt Library",
        "category": category,
        "prompt_text": body.content,
        "variables": tags,
        "recommended_model": "gpt-4.1-mini",
        "estimated_cost_per_use": 0.001,
        "author_user_id": user_id,
        "author_name": "Oxy User",
        "is_verified": False,
        "is_premium": False,
        "usage_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    try:
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/prompts",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=payload,
        )
        res.raise_for_status()
        row = res.json()[0]
        return _prompt_to_api(row)
    except Exception as e:
        log.error("prompts_create_failed", org_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create prompt")


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    member_ids = await _org_member_ids(org_id)
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/prompts",
            params={"id": f"eq.{prompt_id}", "select": "*", "limit": "1"},
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Prompt not found")
        row = rows[0]
        if not _allowed_prompt(row, member_ids):
            raise HTTPException(status_code=403, detail="Not allowed to view this prompt")
        return _prompt_to_api(row)
    except HTTPException:
        raise
    except Exception as e:
        log.error("prompts_get_failed", org_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch prompt")


@router.patch("/{prompt_id}")
async def update_prompt(
    prompt_id: str,
    body: PromptUpdateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]
    member_ids = await _org_member_ids(org_id)
    try:
        existing = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/prompts",
            params={"id": f"eq.{prompt_id}", "select": "*", "limit": "1"},
            headers=get_supabase_headers(),
        )
        existing.raise_for_status()
        rows = existing.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Prompt not found")
        row = rows[0]
        if not _allowed_prompt(row, member_ids) or row.get("author_user_id") not in member_ids:
            raise HTTPException(status_code=403, detail="Not allowed to edit this prompt")

        update_payload = {}
        if body.name is not None:
            update_payload["title"] = body.name
        if body.description is not None:
            update_payload["description"] = body.description
        if body.content is not None:
            update_payload["prompt_text"] = body.content
        if body.tags is not None:
            update_payload["variables"] = body.tags
            update_payload["category"] = _category_from_tags(body.tags)
        update_payload["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/prompts",
            params={"id": f"eq.{prompt_id}"},
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=update_payload,
        )
        res.raise_for_status()
        updated = res.json()[0]
        return _prompt_to_api(updated)
    except HTTPException:
        raise
    except Exception as e:
        log.error("prompts_update_failed", org_id=org_id, user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update prompt")


@router.delete("/{prompt_id}", status_code=204)
async def delete_prompt(prompt_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    member_ids = await _org_member_ids(org_id)
    try:
        existing = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/prompts",
            params={"id": f"eq.{prompt_id}", "select": "id,author_user_id", "limit": "1"},
            headers=get_supabase_headers(),
        )
        existing.raise_for_status()
        rows = existing.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Prompt not found")
        row = rows[0]
        if row.get("author_user_id") not in member_ids:
            raise HTTPException(status_code=403, detail="Not allowed to delete this prompt")

        res = await resources.http_client.delete(
            f"{SUPABASE_URL}/rest/v1/prompts",
            params={"id": f"eq.{prompt_id}"},
            headers=get_supabase_headers(),
        )
        res.raise_for_status()
        return {}
    except HTTPException:
        raise
    except Exception as e:
        log.error("prompts_delete_failed", org_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete prompt")

