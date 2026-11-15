import hashlib
import secrets
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import resources, SUPABASE_URL, log
from core.audit import log_admin_event
from dependencies import (
    CacheData,
    build_api_key_dependency,
    forget_cached_api_key,
    get_user_and_key_from_api_key,
    get_supabase_headers,
)

router = APIRouter(prefix="/v1/api-keys", tags=["api-keys"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(default="API Key", min_length=1, max_length=100)


def _hash_key(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


async def _org_project_ids(org_id: str) -> List[str]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/projects",
        params={
            "organization_id": f"eq.{org_id}",
            "select": "id",
            "limit": "200",
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    return [r["id"] for r in rows]


def _safe_key(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("key_name"),
        "prefix": row.get("key_prefix"),
        "created_at": row.get("created_at"),
        "last_used_at": row.get("last_used_at"),
        "rotation_required_at": row.get("rotation_required_at"),
        "status": "active" if row.get("is_active", True) else "revoked",
    }


@router.get("")
async def list_api_keys(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    project_ids = await _org_project_ids(org_id)
    if not project_ids:
        return {"items": []}
    pid_list = ",".join(project_ids)
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/api_keys",
        params={
            "project_id": f"in.({pid_list})",
            "select": "id,key_name,key_prefix,created_at,last_used_at,rotation_required_at,is_active",
            "order": "created_at.desc",
            "limit": "200",
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    return {"items": [_safe_key(r) for r in rows]}


@router.post("")
async def create_api_key(
    body: ApiKeyCreateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    project_id = key_data["project_id"]
    user_id = key_data["user_id"]

    raw_secret = f"oxy_live_{secrets.token_hex(16)}"
    key_prefix = raw_secret[:12]
    key_hash = _hash_key(raw_secret)

    payload = {
        "project_id": project_id,
        "created_by": user_id,
        "key_name": body.name,
        "key_prefix": key_prefix,
        "key_hash": key_hash,
        "is_active": True,
    }
    try:
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=payload,
        )
        res.raise_for_status()
        row = res.json()[0]
        try:
            await log_admin_event(
                organization_id=org_id,
                event_type="api_key.created",
                actor_id=user_id,
                actor_type="api_key",
                metadata={"key_id": row.get("id"), "prefix": key_prefix},
            )
        except Exception:
            pass
        return {
            "id": row.get("id"),
            "name": row.get("key_name"),
            "secret": raw_secret,
            "prefix": key_prefix,
            "created_at": row.get("created_at"),
            "status": "active",
        }
    except Exception as e:
        log.error("api_key_create_failed", organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create API key")


@router.delete("/{key_id}")
async def revoke_api_key(key_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    project_ids = await _org_project_ids(org_id)
    if not project_ids:
        raise HTTPException(status_code=404, detail="Key not found")
    pid_list = ",".join(project_ids)
    try:
        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            params={"id": f"eq.{key_id}", "project_id": f"in.({pid_list})"},
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json={"is_active": False, "deactivated_at": "now()", "deactivated_reason": "revoked_by_user"},
        )
        res.raise_for_status()
        rows = res.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Key not found")
        row = rows[0]
        # The key's cached record goes too, or a revoked key keeps working until the
        # cache expires. Redis down: say so, the caller can repeat the revocation.
        try:
            await forget_cached_api_key(row.get("key_hash"), row.get("project_id"))
        except Exception as e:
            log.error("api_key_revoke_cache_clear_failed", key_id=key_id, error=str(e)[:200])
            raise HTTPException(
                status_code=503,
                detail="The key is revoked in the database, but its cached record could not be cleared. Repeat the request.",
            )
        try:
            await log_admin_event(
                organization_id=org_id,
                event_type="api_key.revoked",
                actor_id=key_data.get("user_id"),
                actor_type="api_key",
                metadata={"key_id": key_id, "prefix": row.get("key_prefix")},
            )
        except Exception:
            pass
        return _safe_key(row)
    except HTTPException:
        raise
    except Exception as e:
        log.error("api_key_revoke_failed", key_id=key_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to revoke API key")

