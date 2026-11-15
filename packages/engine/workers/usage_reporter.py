"""
OXY ENGINE - USAGE REPORTER WORKER
===================================
Metered usage reporting for enterprise-tier subscriptions (optional Stripe module).

Purpose: Report API usage to Stripe for usage-based billing.
Schedule: Runs daily at 00:00 UTC (via cron)

How It Works:
1. Query request_logs for yesterday's usage
2. Aggregate tokens per enterprise-tier subscription
3. Report units above the included baseline to Stripe Metered Billing
4. Stripe invoices at month-end using the operator's metered price
   (STRIPE_USAGE_PRICE_ID); no amounts are set here

Example (baseline 10M tokens, 1 unit = 1K tokens):
- Organization uses 25M tokens in a month
- Overage: 15M tokens = 15,000 units reported to Stripe

Idempotency:
- Stripe uses timestamp + subscription_item as dedup key
- Safe to re-run for same day (overwrites previous report)
- No risk of double-billing

Author: Oxy contributors
License: Apache 2.0
"""

import os
import asyncio
import stripe
from datetime import datetime, timedelta, timezone
from typing import Dict, List
import structlog

from core import resources

log = structlog.get_logger(__name__)

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_USAGE_PRICE_ID = os.getenv("STRIPE_USAGE_PRICE_ID")

# Usage model
ENTERPRISE_BASELINE_TOKENS = int(os.getenv("ENTERPRISE_INCLUDED_TOKENS", "10000000"))  # tokens included per month
TOKENS_PER_BILLING_UNIT = 1_000          # Stripe bills in units of 1K tokens
# Informational only (logs and billing_audit_log); Stripe bills with the
# metered price itself. Set it to the amount of STRIPE_USAGE_PRICE_ID.
PRICE_PER_UNIT = float(os.getenv("USAGE_UNIT_PRICE_USD", "0"))


async def get_enterprise_subscriptions() -> List[Dict]:
    """
    Fetch all active Enterprise subscriptions from database.
    
    Returns list of:
    {
        "user_id": "uuid...",
        "subscription_id": "uuid...",
        "stripe_subscription_id": "sub_...",
        "stripe_customer_id": "cus_..."
    }
    """
    try:
        # FIX: column is 'plan_tier', not 'subscription_plan'
        result = await resources.supabase.table("subscriptions") \
            .select("user_id, id, stripe_subscription_id, stripe_customer_id, plan_tier") \
            .eq("plan_tier", "enterprise") \
            .eq("status", "active") \
            .execute()
        
        if not result.data:
            log.info("no_enterprise_subscriptions_found")
            return []
        
        log.info("enterprise_subscriptions_fetched", count=len(result.data))
        return result.data
    
    except Exception as e:
        log.error("fetch_enterprise_subscriptions_failed", error=str(e), exc_info=True)
        return []


async def get_user_usage_yesterday(user_id: str, date: datetime) -> int:
    """
    Calculate total tokens used by a user on a specific date.
    
    Returns: Total tokens (prompt + completion)
    """
    try:
        # Query request_logs for the specific date
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        result = await resources.supabase.table("request_logs") \
            .select("prompt_tokens, completion_tokens") \
            .eq("user_id", user_id) \
            .gte("created_at", start_of_day.isoformat()) \
            .lt("created_at", end_of_day.isoformat()) \
            .execute()
        
        if not result.data:
            return 0
        
        # Sum all tokens
        total_tokens = sum(
            (log.get("prompt_tokens", 0) or 0) + (log.get("completion_tokens", 0) or 0)
            for log in result.data
        )
        
        return total_tokens
    
    except Exception as e:
        log.error("get_user_usage_failed", user_id=user_id, date=date.isoformat(), error=str(e), exc_info=True)
        return 0


async def report_usage_to_stripe(
    subscription_id: str,
    stripe_subscription_id: str,
    user_id: str,
    tokens_used: int,
    date: datetime
) -> bool:
    """
    Report usage to Stripe Metered Billing API.
    
    Args:
        subscription_id: Internal subscription UUID
        stripe_subscription_id: Stripe subscription ID (sub_...)
        user_id: User UUID (for logging)
        tokens_used: Total tokens used
        date: Date of usage
    
    Returns: True if successful, False otherwise
    """
    try:
        # Calculate billable units (in 1K token increments)
        billable_units = tokens_used // TOKENS_PER_BILLING_UNIT
        
        if billable_units == 0:
            log.debug("no_usage_to_report", user_id=user_id, tokens=tokens_used)
            return True  # Nothing to report, but not an error
        
        # Get subscription items (need the metered usage item ID)
        subscription = stripe.Subscription.retrieve(stripe_subscription_id)
        
        # Find the usage-based subscription item
        usage_item = None
        for item in subscription.get("items", {}).get("data", []):
            if item["price"]["id"] == STRIPE_USAGE_PRICE_ID:
                usage_item = item
                break
        
        if not usage_item:
            log.error("stripe_usage_item_not_found",
                     subscription_id=stripe_subscription_id,
                     expected_price_id=STRIPE_USAGE_PRICE_ID,
                     message="Enterprise subscription missing usage-based price item")
            return False
        
        # Report usage to Stripe
        # Stripe uses (subscription_item_id, timestamp) as idempotency key
        # Safe to re-run for same day (overwrites previous report)
        usage_record = stripe.SubscriptionItem.create_usage_record(
            subscription_item=usage_item["id"],
            quantity=billable_units,
            timestamp=int(date.timestamp()),
            action="set"  # "set" = overwrite (idempotent), "increment" = add (dangerous)
        )
        
        log.info("usage_reported_to_stripe",
                user_id=user_id,
                subscription_id=subscription_id,
                stripe_subscription_id=stripe_subscription_id,
                tokens_used=tokens_used,
                billable_units=billable_units,
                billable_amount_usd=billable_units * PRICE_PER_UNIT,
                date=date.isoformat(),
                usage_record_id=usage_record["id"])
        
        # Store audit log in database
        await resources.supabase.table("billing_audit_log").insert({
            "user_id": user_id,
            "subscription_id": subscription_id,
            "event_type": "usage_reported",
            "stripe_event_id": usage_record["id"],
            "amount_cents": int(billable_units * PRICE_PER_UNIT * 100),  # Convert to cents
            "currency": "usd",
            "metadata": {
                "date": date.isoformat(),
                "tokens_used": tokens_used,
                "billable_units": billable_units
            }
        }).execute()
        
        return True
    
    except stripe.error.StripeError as e:
        log.error("stripe_usage_report_failed",
                 user_id=user_id,
                 subscription_id=subscription_id,
                 stripe_error_type=type(e).__name__,
                 stripe_error_message=str(e),
                 exc_info=True)
        return False
    
    except Exception as e:
        log.error("usage_report_unexpected_error",
                 user_id=user_id,
                 subscription_id=subscription_id,
                 error=str(e),
                 exc_info=True)
        return False


async def report_all_usage_yesterday():
    """
    Main worker function: Report yesterday's usage for all enterprise-tier subscriptions.
    
    This function is idempotent (safe to re-run).
    Schedule: Run daily at 00:00 UTC via cron.
    """
    start_time = datetime.now(timezone.utc)
    yesterday = start_time - timedelta(days=1)
    
    log.info("usage_reporter_started",
            timestamp=start_time.isoformat(),
            reporting_date=yesterday.date().isoformat())
    
    # Fetch all Enterprise subscriptions
    subscriptions = await get_enterprise_subscriptions()
    
    if not subscriptions:
        log.info("usage_reporter_finished_no_subscriptions", duration_seconds=0)
        return
    
    # Report usage for each subscription
    results = {
        "success": 0,
        "failed": 0,
        "no_usage": 0
    }
    
    for sub in subscriptions:
        user_id = sub["user_id"]
        subscription_id = sub["id"]
        stripe_subscription_id = sub["stripe_subscription_id"]
        
        # Get yesterday's usage
        tokens_used = await get_user_usage_yesterday(user_id, yesterday)
        
        if tokens_used == 0:
            results["no_usage"] += 1
            continue
        
        # Report to Stripe
        success = await report_usage_to_stripe(
            subscription_id=subscription_id,
            stripe_subscription_id=stripe_subscription_id,
            user_id=user_id,
            tokens_used=tokens_used,
            date=yesterday
        )
        
        if success:
            results["success"] += 1
        else:
            results["failed"] += 1
        
        # Rate limit: Small delay between Stripe API calls (avoid rate limiting)
        await asyncio.sleep(0.1)
    
    # Log final results
    end_time = datetime.now(timezone.utc)
    duration = (end_time - start_time).total_seconds()
    
    log.info("usage_reporter_finished",
            timestamp=end_time.isoformat(),
            reporting_date=yesterday.date().isoformat(),
            total_subscriptions=len(subscriptions),
            successful_reports=results["success"],
            failed_reports=results["failed"],
            no_usage=results["no_usage"],
            duration_seconds=duration)
    
    # Alert if high failure rate
    if results["failed"] > 0 and results["success"] > 0:
        failure_rate = results["failed"] / (results["success"] + results["failed"])
        if failure_rate > 0.2:  # More than 20% failures
            log.error("usage_reporter_high_failure_rate",
                     failure_rate=failure_rate,
                     failed_count=results["failed"],
                     total_count=results["success"] + results["failed"],
                     message="CRITICAL: High failure rate in usage reporting. Investigate immediately!")


# ============================================================================
# MANUAL TESTING & BACKFILL
# ============================================================================

async def report_usage_for_date(date: datetime):
    """
    Manual function: Report usage for a specific date (for backfilling).
    
    Usage:
    >>> from workers.usage_reporter import report_usage_for_date
    >>> import asyncio
    >>> from datetime import datetime
    >>> asyncio.run(report_usage_for_date(datetime(2025, 11, 20)))
    """
    log.info("manual_usage_report_started", date=date.isoformat())
    
    subscriptions = await get_enterprise_subscriptions()
    
    for sub in subscriptions:
        tokens_used = await get_user_usage_yesterday(sub["user_id"], date)
        if tokens_used > 0:
            await report_usage_to_stripe(
                subscription_id=sub["id"],
                stripe_subscription_id=sub["stripe_subscription_id"],
                user_id=sub["user_id"],
                tokens_used=tokens_used,
                date=date
            )
            await asyncio.sleep(0.1)
    
    log.info("manual_usage_report_finished", date=date.isoformat())


# ============================================================================
# ENTRY POINT (for cron job)
# ============================================================================

if __name__ == "__main__":
    """
    Run this worker from command line:
    $ python -m workers.usage_reporter
    
    Or via cron (add to crontab):
    0 0 * * * cd /path/to/oxy/packages/engine && python -m workers.usage_reporter >> /var/log/oxy/usage_reporter.log 2>&1
    """
    asyncio.run(report_all_usage_yesterday())

