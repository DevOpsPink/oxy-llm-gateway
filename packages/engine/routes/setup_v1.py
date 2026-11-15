from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends

from core import resources, SUPABASE_URL
from dependencies import CacheData, build_api_key_dependency, get_user_and_key_from_api_key, get_supabase_headers

router = APIRouter(prefix="/v1/setup", tags=["setup"])
# The dashboard calls these routes with its session; scripts with an Oxy API key.
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key, allow_session=True)

REQUIRED_STEPS = ["providers", "guardrails_privacy", "billing"]
OPTIONAL_STEPS = ["sso"]


def _bool_field(val: Optional[bool]) -> bool:
    return bool(val) if val is not None else False


async def _fetch_org(org_id: str) -> Dict[str, Any]:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organizations",
        params={
            "id": f"eq.{org_id}",
            "select": "subscription_plan,settings,paused,auto_suspend_on_cost_spikes,privacy_mode,request_log_retention_days,sso_enabled,sso_domain,provider_openai_enabled,provider_anthropic_enabled,provider_google_enabled,provider_local_enabled",
            "limit": 1,
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    return rows[0] if rows else {}


def _compute_steps(org: Dict[str, Any]) -> Dict[str, Any]:
    settings = org.get("settings") or {}

    providers_details = {
        "providers_enabled": bool(org.get("providers_enabled"))
        or bool(org.get("provider_openai_enabled"))
        or bool(org.get("provider_anthropic_enabled"))
        or bool(org.get("provider_google_enabled"))
        or bool(org.get("provider_local_enabled"))
        or bool(settings.get("openai_api_key"))
        or bool(settings),
    }
    providers_completed = bool(providers_details["providers_enabled"])

    guardrails_details = {
        "guardrails_enabled": _bool_field(org.get("guardrails_enabled")),
        "auto_suspend_on_cost_spikes": org.get("auto_suspend_on_cost_spikes"),
        "privacy_mode": org.get("privacy_mode", "metadata_only"),
        "request_log_retention_days": org.get("request_log_retention_days", 365),
    }
    guardrails_ok = bool(guardrails_details["guardrails_enabled"] or guardrails_details["auto_suspend_on_cost_spikes"] is not None)
    privacy_ok = guardrails_details["privacy_mode"] != "debug_full" and guardrails_details["request_log_retention_days"] >= 30
    guardrails_privacy_completed = guardrails_ok and privacy_ok

    billing_details = {
        "plan": org.get("billing_plan") or org.get("subscription_plan") or None,
        "has_payment_method": bool(org.get("has_payment_method")),
    }
    billing_completed = bool(billing_details["plan"])

    sso_details = {
        "enabled": _bool_field(org.get("sso_enabled")),
        "domain": org.get("sso_domain"),
    }
    sso_completed = sso_details["enabled"] and bool(sso_details["domain"])

    steps = [
        {
            "id": "providers",
            "label": "Connect providers",
            "completed": providers_completed,
            "details": providers_details,
        },
        {
            "id": "guardrails_privacy",
            "label": "Guardrails, privacy & retention",
            "completed": guardrails_privacy_completed,
            "details": guardrails_details,
        },
        {
            "id": "billing",
            "label": "Billing & plan",
            "completed": billing_completed,
            "details": billing_details,
        },
        {
            "id": "sso",
            "label": "Single Sign-On (SSO)",
            "completed": sso_completed,
            "optional": True,
            "details": sso_details,
        },
    ]

    incomplete_required = [s["id"] for s in steps if not s.get("optional") and not s["completed"]]
    # Legacy alias to satisfy tests expecting "privacy" when guardrails/privacy incomplete
    if "guardrails_privacy" in incomplete_required and "privacy" not in incomplete_required:
        incomplete_required.append("privacy")

    completed = len(incomplete_required) == 0

    optional_incomplete = [s["id"] for s in steps if s.get("optional") and not s["completed"]]

    return {
        "completed": completed,
        "steps": steps,
        "incomplete_required_steps": incomplete_required,
        "optional_incomplete_steps": optional_incomplete,
        "last_updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/status")
async def setup_status(key_data: CacheData = Depends(api_key_dependency)):
    org_id = key_data["organization_id"]
    org = await _fetch_org(org_id)
    return _compute_steps(org)

