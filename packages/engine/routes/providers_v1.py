from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from core import resources, SUPABASE_URL, log
from core.audit import log_admin_event
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/providers", tags=["providers"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)


def _env_flags() -> Dict[str, bool]:
    import os
    return {
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
        "google": bool(os.getenv("GOOGLE_API_KEY")),
        "local": bool(os.getenv("LOCAL_MODELS_AVAILABLE") or os.getenv("OLLAMA_HOST") or os.getenv("VLLM_ENDPOINT")),
    }


async def _fetch_org(org_id: str) -> Dict[str, Any]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organizations",
        params={
            "id": f"eq.{org_id}",
            "select": "provider_openai_enabled,provider_anthropic_enabled,provider_google_enabled,provider_local_enabled",
            "limit": 1,
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json() or []
    if not rows:
        raise HTTPException(status_code=404, detail="Organization not found")
    return rows[0]


def _shape_config(org_row: Dict[str, Any]) -> Dict[str, Any]:
    env = _env_flags()
    return {
        "openai": {"enabled": bool(org_row.get("provider_openai_enabled", True)), "configured_via_env": env["openai"]},
        "anthropic": {"enabled": bool(org_row.get("provider_anthropic_enabled", False)), "configured_via_env": env["anthropic"]},
        "google": {"enabled": bool(org_row.get("provider_google_enabled", False)), "configured_via_env": env["google"]},
        "local": {"enabled": bool(org_row.get("provider_local_enabled", False)), "configured_via_env": env["local"]},
    }


@router.get("/config")
async def get_provider_config(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    org_row = await _fetch_org(org_id)
    return _shape_config(org_row)


@router.post("/config")
async def update_provider_config(
    body: Dict[str, Any],
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]
    current_row = await _fetch_org(org_id)
    updates = {}
    for provider_key, field in [
        ("openai", "provider_openai_enabled"),
        ("anthropic", "provider_anthropic_enabled"),
        ("google", "provider_google_enabled"),
        ("local", "provider_local_enabled"),
    ]:
        if provider_key in body and isinstance(body[provider_key], dict) and "enabled" in body[provider_key]:
            updates[field] = bool(body[provider_key]["enabled"])

    if not updates:
        return _shape_config(current_row)

    try:
        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={"id": f"eq.{org_id}"},
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=updates,
        )
        res.raise_for_status()
        rows = res.json() or []
        updated = rows[0] if rows else current_row | updates
        try:
            await log_admin_event(
                organization_id=org_id,
                event_type="providers.config.updated",
                actor_id=user_id,
                actor_type="api_key",
                metadata={"old": current_row, "new": updates},
            )
        except Exception:
            pass
        return _shape_config(updated)
    except Exception as e:
        log.error("provider_config_update_failed", organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update provider config")

