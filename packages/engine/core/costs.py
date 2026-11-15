"""
Cost pipeline utilities (Core 0.1)

- Single point for cost calculation and request logging.
- Keeps DB as source of truth; Redis/BudgetManager are best-effort helpers.
"""

from __future__ import annotations

import asyncio
import uuid

from decimal import Decimal
from typing import Any, Dict, Optional

from core import log, resources
from providers import PricingEngine
from security_utils import log_error_safe
from core.privacy_logging import sanitize_event_for_logging, DEFAULT_MODE


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> Decimal:
    """Wrapper to calculate cost as Decimal with safe defaults."""
    try:
        return PricingEngine.calculate_cost(model, prompt_tokens, completion_tokens)
    except Exception as e:
        log_error_safe(log, "cost_calc_failed", e, model=model)
        return Decimal("0.0")


async def record_request(
    *,
    user_id: str,
    project_id: str,
    organization_id: str,
    model: str,
    provider: str,
    status: str,
    threat: str,
    threat_type: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost: Decimal,
    subscription_id: Optional[str],
    reserved_amount: Decimal,
    api_key_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    cache_hit: bool = False,
    cost_tags: Optional[Dict[str, Any]] = None,
    privacy_mode: Optional[str] = None,
    prompt_text: Optional[str] = None,
    response_text: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> None:
    """
    Record request cost/usage and adjust budget (best-effort).

    - Persists to request_logs when Supabase is available.
    - Adjusts budget via BudgetManager even if logging is skipped.
    """
    total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)
    safe_tags = cost_tags or {}

    supabase_available = getattr(resources, "supabase", None) is not None
    budget_manager = getattr(resources, "budget_manager", None)

    # Build privacy-safe payload
    base_event = {
        "user_id": user_id,
        "project_id": project_id,
        "organization_id": organization_id,
        "api_key_id": api_key_id,
        "agent_id": agent_id,
        "session_id": session_id,
        "model": model,
        "provider": provider,
        "status": status,
        # Mark threat_detected when any threat is present (blocked or detected/logged)
        "threat_detected": threat not in ("none", None, ""),
        "threat_type": threat_type,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "tokens_input": prompt_tokens,
        "tokens_output": completion_tokens,
        "tokens_total": total_tokens,
        "cost_usd": float(cost),
        "subscription_id": subscription_id,
        "cache_hit": cache_hit,
        "cost_tags": safe_tags,
        "latency_ms": latency_ms,
    }

    sanitized_payload = sanitize_event_for_logging(
        privacy_mode=privacy_mode or DEFAULT_MODE,
        event={
            **base_event,
            "prompt_text": prompt_text,
            "response_text": response_text,
        },
    )

    # Remove None values to avoid schema violations on insert
    payload = {k: v for k, v in sanitized_payload.items() if v is not None}

    # Persist request log
    if supabase_available:
        # The audit trail should survive a busy database: retry transient failures.
        # The row id is fixed client-side and written as an upsert, so a retry after
        # a lost response cannot create a second row.
        payload.setdefault("id", str(uuid.uuid4()))
        for attempt in range(3):
            try:
                resp = await resources.supabase.table("request_logs").upsert(payload).execute()
                status_code = getattr(resp, "status_code", None)
                error_msg = getattr(resp, "error", None) or getattr(resp, "message", None)
                if status_code and status_code >= 500 and attempt < 2:
                    await asyncio.sleep(0.25 * (attempt + 1))
                    continue
                if status_code and status_code >= 400:
                    log.warning(
                        "request_log_failed_soft",
                        status_code=status_code,
                        error=error_msg,
                        payload_keys=list(payload.keys()),
                    )
                break
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(0.25 * (attempt + 1))
                    continue
                # Log sanitized error details once; do not crash request flow
                log_error_safe(log, "request_log_failed_soft", e, payload_summary="request_log")
    else:
        log.info(
            "request_log_skipped_supabase_missing",
            project_id=project_id,
            organization_id=organization_id,
        )

    # Budget adjustment (best-effort)
    if budget_manager and reserved_amount is not None:
        try:
            adjustment = cost - reserved_amount
            await budget_manager.adjust_budget(project_id, adjustment)
        except Exception as e:
            log_error_safe(log, "budget_adjust_failed_after_log", e, project_id=project_id)
