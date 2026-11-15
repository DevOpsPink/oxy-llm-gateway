import secrets
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from core import resources, SUPABASE_URL, log
from core.audit import log_admin_event
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1", tags=["notifications"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)

ALLOWED_EVENTS = {"budget.threshold_crossed", "anomaly.raised", "request.created"}
SLACK_PREFIX = "https://hooks.slack.com/"
DISCORD_PREFIXES = ("https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/")
ZAPIER_PREFIX = "https://hooks.zapier.com/"


class NotificationSettingsRequest(BaseModel):
    alerts_email: str | None = Field(default=None)
    budget_email_enabled: bool = True
    anomaly_email_enabled: bool = True
    slack_webhook_url: str | None = None
    slack_enabled: bool = False
    discord_webhook_url: str | None = None
    discord_enabled: bool = False
    zapier_webhook_url: str | None = None
    zapier_enabled: bool = False
    zapier_events: List[str] | None = None

    @field_validator("alerts_email")
    @classmethod
    def validate_email(cls, v):
        if v is None or v == "":
            return None
        if "@" not in v:
            raise ValueError("Invalid email")
        return v.strip().lower()

    @field_validator("zapier_events")
    @classmethod
    def validate_zapier_events(cls, v):
        if v is None:
            return None
        invalid = [ev for ev in v if ev not in ALLOWED_EVENTS]
        if invalid:
            raise ValueError(f"Invalid event type(s): {', '.join(invalid)}")
        return v


def _validate_slack_webhook(url: str | None) -> bool:
    if not url:
        return False
    return url.startswith(SLACK_PREFIX)


def _validate_discord_webhook(url: str | None) -> bool:
    if not url:
        return False
    return any(url.startswith(prefix) for prefix in DISCORD_PREFIXES)


def _validate_zapier_webhook(url: str | None) -> bool:
    if not url:
        return False
    return url.startswith(ZAPIER_PREFIX)


def _sanitize_for_audit(payload: Dict[str, Any]) -> Dict[str, Any]:
    redacted = dict(payload or {})
    for key in ["slack_webhook_url", "discord_webhook_url", "zapier_webhook_url"]:
        if redacted.get(key):
            redacted[key] = "***redacted***"
    return redacted


class WebhookCreateRequest(BaseModel):
    url: str
    event_types: List[str]

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Invalid URL")
        return v

    @field_validator("event_types")
    @classmethod
    def validate_events(cls, v):
        if not v:
            raise ValueError("event_types required")
        for ev in v:
            if ev not in ALLOWED_EVENTS:
                raise ValueError(f"Invalid event type: {ev}")
        return v


async def _fetch_settings(org_id: str) -> Dict[str, Any]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/notification_settings",
        params={
            "organization_id": f"eq.{org_id}",
            "select": "alerts_email,budget_email_enabled,anomaly_email_enabled,slack_webhook_url,slack_enabled,discord_webhook_url,discord_enabled,zapier_webhook_url,zapier_enabled,zapier_events",
            "limit": 1,
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    if not rows:
        return {
            "alerts_email": None,
            "budget_email_enabled": True,
            "anomaly_email_enabled": True,
            "slack_webhook_url": None,
            "slack_enabled": False,
            "discord_webhook_url": None,
            "discord_enabled": False,
            "zapier_webhook_url": None,
            "zapier_enabled": False,
            "zapier_events": [],
        }
    return rows[0]


@router.get("/notifications/settings")
async def get_notification_settings(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    return await _fetch_settings(org_id)


@router.post("/notifications/settings")
async def update_notification_settings(
    body: NotificationSettingsRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    current = await _fetch_settings(org_id)
    payload = body.model_dump()

    if payload.get("slack_enabled") and not _validate_slack_webhook(payload.get("slack_webhook_url")):
        raise HTTPException(
            status_code=400,
            detail="Invalid Slack webhook URL. Must start with https://hooks.slack.com/.",
        )
    if payload.get("discord_enabled") and not _validate_discord_webhook(payload.get("discord_webhook_url")):
        raise HTTPException(
            status_code=400,
            detail="Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/...",
        )
    if payload.get("zapier_enabled") and not _validate_zapier_webhook(payload.get("zapier_webhook_url")):
        raise HTTPException(
            status_code=400,
            detail="Invalid Zapier webhook URL. Must start with https://hooks.zapier.com/.",
        )
    if payload.get("zapier_events"):
        invalid = [ev for ev in payload["zapier_events"] if ev not in ALLOWED_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid event type(s): {', '.join(invalid)}")
    if payload.get("zapier_events") is None:
        payload["zapier_events"] = []

    try:
        res = await resources.http_client.upsert(  # type: ignore
            f"{SUPABASE_URL}/rest/v1/notification_settings",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json={**payload, "organization_id": org_id},
        )
    except AttributeError:
        # If http_client has no upsert helper, fallback to post with on_conflict
        res = await resources.http_client.post(
            f"{SUPABASE_URL}/rest/v1/notification_settings",
            params={"on_conflict": "organization_id"},
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json={**payload, "organization_id": org_id},
        )
    res.raise_for_status()
    rows = res.json()
    updated = rows[0] if rows else payload
    try:
        await log_admin_event(
            organization_id=org_id,
            event_type="notifications.settings.updated",
            actor_id=key_data.get("user_id"),
            actor_type="api_key",
            metadata={"old": _sanitize_for_audit(current), "new": _sanitize_for_audit(updated)},
        )
    except Exception:
        pass
    return updated


@router.get("/webhooks")
async def list_webhooks(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/webhooks",
        params={
            "organization_id": f"eq.{org_id}",
            "disabled_at": "is.null",
            "select": "id,url,event_types,created_at,disabled_at",
            "order": "created_at.desc",
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    return {"webhooks": res.json() or []}


@router.post("/webhooks")
async def create_webhook(
    body: WebhookCreateRequest,
    key_data: CacheData = Depends(api_key_dependency),
):
    org_id = key_data["organization_id"]
    user_id = key_data["user_id"]
    secret = secrets.token_hex(16)
    res = await resources.http_client.post(
        f"{SUPABASE_URL}/rest/v1/webhooks",
        headers={**get_supabase_headers(), "Prefer": "return=representation"},
        json={
            "organization_id": org_id,
            "url": body.url,
            "event_types": body.event_types,
            "secret": secret,
        },
    )
    if res.status_code not in [200, 201]:
        raise HTTPException(status_code=500, detail="Failed to create webhook")
    rows = res.json() or []
    webhook = rows[0]
    try:
        await log_admin_event(
            organization_id=org_id,
            event_type="webhook.created",
            actor_id=user_id,
            actor_type="api_key",
            metadata={"webhook_id": webhook.get("id"), "url": body.url, "event_types": body.event_types},
        )
    except Exception:
        pass
    webhook.pop("secret", None)
    return webhook


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    res = await resources.http_client.patch(
        f"{SUPABASE_URL}/rest/v1/webhooks",
        params={"id": f"eq.{webhook_id}", "organization_id": f"eq.{org_id}"},
        headers={**get_supabase_headers(), "Prefer": "return=representation"},
        json={"disabled_at": "now()"},
    )
    if res.status_code not in [200, 204]:
        raise HTTPException(status_code=500, detail="Failed to delete webhook")
    rows = res.json() or []
    try:
        await log_admin_event(
            organization_id=org_id,
            event_type="webhook.deleted",
            actor_id=key_data.get("user_id"),
            actor_type="api_key",
            metadata={"webhook_id": webhook_id},
        )
    except Exception:
        pass
    return {"status": "ok"}

