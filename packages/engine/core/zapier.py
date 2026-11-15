"""
Zapier outbound notifier (best-effort, minimal payload).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Callable
from urllib.parse import urlparse

import httpx

from core import SUPABASE_URL, resources, log
from dependencies import get_supabase_headers

ZAPIER_PREFIX = "https://hooks.zapier.com/"
DEFAULT_EVENTS: List[str] = ["budget.threshold_crossed", "anomaly.raised"]
TIMEOUT = 5.0
MAX_RETRIES = 1
BACKOFF_SECONDS = 0.5

PostFn = Callable[[str, Dict[str, Any]], Any]


def _safe_host(url: str | None) -> str | None:
    if not url:
        return None
    try:
        return urlparse(url).netloc
    except Exception:
        return None


def _should_send(settings: Dict[str, Any], event_type: str) -> bool:
    if not settings.get("zapier_enabled"):
        return False
    url = settings.get("zapier_webhook_url")
    if not url or not url.startswith(ZAPIER_PREFIX):
        return False
    events = settings.get("zapier_events") or DEFAULT_EVENTS
    return event_type in events


async def _fetch_settings(org_id: str) -> Dict[str, Any]:
    try:
        res = await resources.http_client.get(
            f"{SUPABASE_URL}/rest/v1/notification_settings",
            params={
                "organization_id": f"eq.{org_id}",
                "select": "zapier_webhook_url,zapier_enabled,zapier_events",
                "limit": 1,
            },
            headers=get_supabase_headers(),
            timeout=TIMEOUT,
        )
        res.raise_for_status()
        rows = res.json() or []
        return rows[0] if rows else {}
    except Exception as exc:
        log.error("zapier_fetch_failed", org_id=org_id, error=str(exc)[:200])
        return {}


async def _default_post(url: str, payload: Dict[str, Any]) -> httpx.Response:
    async with httpx.AsyncClient() as client:
        return await client.post(url, json=payload, timeout=TIMEOUT)


async def _post_with_retry(
    url: str,
    payload: Dict[str, Any],
    *,
    post: PostFn | None = None,
    max_retries: int = MAX_RETRIES,
    backoff_seconds: float = BACKOFF_SECONDS,
) -> bool:
    post_fn = post or _default_post
    attempt = 0
    host = _safe_host(url)
    while True:
        try:
            resp = await post_fn(url, payload)
            status = getattr(resp, "status_code", None)
            if status is None or status < 400:
                return True
            if status >= 500 and attempt < max_retries:
                attempt += 1
                await asyncio.sleep(backoff_seconds * attempt)
                continue
            log.warning("zapier_send_failed", host=host, status_code=status)
            return False
        except Exception as exc:
            if attempt < max_retries:
                attempt += 1
                await asyncio.sleep(backoff_seconds * attempt)
                continue
            log.error("zapier_send_exception", host=host, error=str(exc)[:200])
            return False


def _scrub_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    # Drop obviously sensitive keys if present.
    blocked_keys = {"prompt", "prompt_text", "response_text", "secret", "api_key"}
    return {k: v for k, v in (payload or {}).items() if k not in blocked_keys}


async def send_zapier_event(org_id: str, event_type: str, payload: Dict[str, Any], post: PostFn | None = None) -> bool:
    settings = await _fetch_settings(org_id)
    if not _should_send(settings, event_type):
        return False
    zapier_url = settings.get("zapier_webhook_url")
    if not zapier_url:
        return False

    body: Dict[str, Any] = {
        "event_type": event_type,
        "organization_id": org_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    body.update(_scrub_payload(payload))

    return await _post_with_retry(zapier_url, body, post=post)
