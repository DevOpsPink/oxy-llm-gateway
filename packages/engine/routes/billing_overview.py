from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core import log, resources, SUPABASE_URL
from core.budget import BudgetManager
from dependencies import CacheData, build_api_key_dependency, get_supabase_headers, auth_scheme, get_user_and_key_from_api_key
from routes.usage import get_org_monthly_usage, current_month_slug

router = APIRouter(prefix="/v1", tags=["billing"])
api_key_dependency = build_api_key_dependency(lambda: get_user_and_key_from_api_key)

FREE_PLAN_LIMIT = 100_000


def _next_month_reset() -> str:
    now = datetime.now(timezone.utc)
    year = now.year + (1 if now.month == 12 else 0)
    month = 1 if now.month == 12 else now.month + 1
    reset_dt = datetime(year, month, 1, tzinfo=timezone.utc)
    return reset_dt.isoformat()


async def _fetch_org_plan(org_id: str) -> str:
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organizations",
        params={
            "id": f"eq.{org_id}",
            "select": "subscription_plan",
            "limit": 1,
        },
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    rows = res.json()
    if not rows:
        return "free"
    return rows[0].get("subscription_plan") or "free"


async def _fetch_referral_code(org_id: str) -> Optional[str]:
    # Look up owner profile via organization
    res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/organizations",
        params={"id": f"eq.{org_id}", "select": "owner_user_id", "limit": 1},
        headers=get_supabase_headers(),
    )
    res.raise_for_status()
    data = res.json()
    if not data:
        return None
    owner_id = data[0].get("owner_user_id")
    if not owner_id:
        return None
    profile_res = await resources.http_client.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        params={"id": f"eq.{owner_id}", "select": "referral_code", "limit": 1},
        headers=get_supabase_headers(),
    )
    profile_res.raise_for_status()
    prof = profile_res.json()
    if not prof:
        return None
    return prof[0].get("referral_code")


@router.get("/billing/overview")
async def billing_overview(
    key_data: CacheData = Depends(api_key_dependency),
    creds=Depends(auth_scheme),
):
    """
    Billing overview for dashboard:
    - plan
    - free plan usage (if applicable)
    - referral code and credits
    """
    org_id = key_data["organization_id"]

    try:
        plan = await _fetch_org_plan(org_id)
        usage = await get_org_monthly_usage(org_id)
        budget_manager = BudgetManager(resources.redis)
        credits = await budget_manager.get_credits_balance(org_id)
        referral_code = await _fetch_referral_code(org_id)

        payload = {
            "plan": plan,
            "free_plan_limit_per_month": FREE_PLAN_LIMIT if plan == "free" else None,
            "free_plan_usage_this_month": usage if plan == "free" else None,
            "referral_code": referral_code,
            "referral_credits_usd": float(credits),
            "next_reset_at": _next_month_reset() if plan == "free" else None,
            "month": current_month_slug(),
        }
        return payload
    except HTTPException:
        raise
    except Exception as e:
        log.error("billing_overview_failed", organization_id=org_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load billing overview")

