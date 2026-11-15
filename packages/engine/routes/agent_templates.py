import os
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core import log, resources, SUPABASE_URL
from core.agent_templates import merge_guardrails, validate_template_payload
from dependencies import CacheData, build_api_key_dependency, get_supabase_headers, get_user_and_key_from_api_key

router = APIRouter(prefix="/v1/agent-templates", tags=["agent-templates"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)


class TemplatePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    model: str
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None
    tools: Optional[Dict[str, Any]] = None
    max_tokens: Optional[int] = Field(None, ge=1, le=128000)
    metadata: Optional[Dict[str, Any]] = None
    guardrail_config: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None


class TemplateResponse(TemplatePayload):
    id: str
    is_archived: bool
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _org_guardrails(org_id: str) -> Dict[str, Any]:
    # Best-effort: fetch org privacy/dlp settings
    try:
        res = resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={"id": f"eq.{org_id}", "select": "privacy_mode,dlp_mode"},
            headers=get_supabase_headers(),
            timeout=5.0,
        )
        # httpx async? resources.http_client likely async; but here use await? The http_client is async; adjust
    except Exception:
        return {}


async def _fetch_org_guardrails(org_id: str) -> Dict[str, Any]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/organizations",
            params={"id": f"eq.{org_id}", "select": "privacy_mode,dlp_mode,allowed_models,allowed_providers"},
            headers=get_supabase_headers(),
            timeout=5.0,
        )
        res.raise_for_status()
        rows = res.json() or []
        if not rows:
            return {}
        org_row = rows[0]
        return {
            "privacy_mode": org_row.get("privacy_mode"),
            "dlp_mode": org_row.get("dlp_mode"),
            "allowed_models": org_row.get("allowed_models"),
            "allowed_providers": org_row.get("allowed_providers"),
        }
    except Exception as exc:
        log.error("fetch_org_guardrails_failed", org_id=org_id, error=str(exc)[:200])
        return {}


async def _get_template(org_id: str, template_id: str) -> Dict[str, Any]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/agent_templates",
        params={"id": f"eq.{template_id}", "organization_id": f"eq.{org_id}", "limit": 1},
        headers=get_supabase_headers(),
        timeout=5.0,
    )
    res.raise_for_status()
    rows = res.json() or []
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")
    return rows[0]


@router.get("", response_model=Dict[str, Any])
async def list_templates(
    project_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    params = {"organization_id": f"eq.{org_id}", "is_archived": "eq.false", "limit": limit}
    if project_id:
        params["project_id"] = f"eq.{project_id}"
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/agent_templates",
        params=params,
        headers=get_supabase_headers(),
        timeout=5.0,
    )
    res.raise_for_status()
    return {"templates": res.json() or []}


@router.post("", response_model=TemplateResponse)
async def create_template(body: TemplatePayload, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]

    try:
        payload = body.model_dump()
        validate_template_payload(payload)

        org_guardrails = await _fetch_org_guardrails(org_id)
        merged_guardrails = merge_guardrails(org_guardrails, payload.get("guardrail_config") or {})

        insert_payload = {
            **payload,
            "guardrail_config": merged_guardrails,
            "organization_id": org_id,
            "created_by": user_id,
            "is_archived": False,
        }

        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/agent_templates",
            headers=get_supabase_headers(),
            json=insert_payload,
            timeout=5.0,
        )
        res.raise_for_status()
        rows = res.json() or []
        return rows[0] if rows else insert_payload
    except HTTPException:
        raise
    except Exception as exc:
        log.error("create_agent_template_failed", org_id=org_id, error=str(exc)[:200])
        raise HTTPException(status_code=400, detail="Failed to create template")


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    tpl = await _get_template(org_id, template_id)
    return tpl


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, body: TemplatePayload, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    template = await _get_template(org_id, template_id)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return template

    try:
        if "name" in updates and not updates["name"]:
            raise HTTPException(status_code=400, detail="Template name is required")
        if "model" in updates and not updates["model"]:
            raise HTTPException(status_code=400, detail="Model is required")

        org_guardrails = await _fetch_org_guardrails(org_id)
        guardrail_cfg = updates.get("guardrail_config", template.get("guardrail_config") or {})
        merged_guardrails = merge_guardrails(org_guardrails, guardrail_cfg)
        updates["guardrail_config"] = merged_guardrails

        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/agent_templates",
            params={"id": f"eq.{template_id}", "organization_id": f"eq.{org_id}"},
            headers=get_supabase_headers(),
            json=updates,
            timeout=5.0,
        )
        res.raise_for_status()
        rows = res.json() or []
        return rows[0] if rows else {**template, **updates}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("update_agent_template_failed", org_id=org_id, template_id=template_id, error=str(exc)[:200])
        raise HTTPException(status_code=400, detail="Failed to update template")


@router.delete("/{template_id}")
async def archive_template(template_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    await _get_template(org_id, template_id)
    try:
        res = await resources.http_client.patch(
            f"{SUPABASE_URL}/rest/v1/agent_templates",
            params={"id": f"eq.{template_id}", "organization_id": f"eq.{org_id}"},
            headers=get_supabase_headers(),
            json={"is_archived": True},
            timeout=5.0,
        )
        res.raise_for_status()
        return {"success": True}
    except Exception as exc:
        log.error("archive_agent_template_failed", org_id=org_id, template_id=template_id, error=str(exc)[:200])
        raise HTTPException(status_code=400, detail="Failed to archive template")


class TemplateSessionRequest(BaseModel):
    display_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@router.post("/{template_id}/sessions")
async def create_session_from_template(
    template_id: str,
    body: TemplateSessionRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]
    template = await _get_template(org_id, template_id)
    if template.get("is_archived"):
        raise HTTPException(status_code=400, detail="Template is archived")

    session_payload = {
        "id": str(uuid4()),
        "organization_id": org_id,
        "project_id": template.get("project_id"),
        "template_id": template_id,
        "status": "running",
        "model": template.get("model"),
        "system_prompt": template.get("system_prompt"),
        "tools": template.get("tools"),
        "metadata": body.metadata or {},
        "display_name": body.display_name or template.get("name"),
        "created_by": user_id,
    }

    try:
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/agent_sessions",
            headers=get_supabase_headers(),
            json=session_payload,
            timeout=5.0,
        )
        res.raise_for_status()
        return {"session_id": session_payload["id"], "template_id": template_id}
    except Exception as exc:
        log.error("create_session_from_template_failed", org_id=org_id, template_id=template_id, error=str(exc)[:200])
        raise HTTPException(status_code=400, detail="Failed to start session from template")
