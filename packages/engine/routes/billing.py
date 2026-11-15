"""
OXY ENGINE - STRIPE BILLING MODULE (OPTIONAL)
=============================================
Subscription billing with Stripe. Optional: without STRIPE_SECRET_KEY and
STRIPE_WEBHOOK_SECRET the Stripe endpoints answer 503 (see billing_gate.py)
and plan tiers are assigned by the operator in the database.


Features:
- Subscription management (create, update, cancel)
- Webhook handling for Stripe events
- Usage-based metered billing
- Financial audit logging
- PCI-DSS compliant (no card data stored)

Security:
- Webhook signature verification (prevents forgery)
- Idempotency keys (prevents duplicate charges)
- Row-level security in database
- Service role authentication for Supabase

Author: Oxy contributors
License: Apache 2.0
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from pydantic import BaseModel, Field

# Import from core.py instead of main.py to break circular dependency;
# use the resources container to avoid None binding issues
from core import (
    log,
    resources,  # ResourceManager instance - access via resources.redis, resources.supabase
)
from dependencies import get_current_user_id
from security_utils import log_error_safe
from billing_gate import billing_enabled, require_billing

# ============================================================================
# STRIPE CONFIGURATION
# ============================================================================

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
# Sender and reply address for billing mail (only used when Stripe is enabled).
BILLING_EMAIL = os.getenv("BILLING_EMAIL", "billing@example.com")

# ============================================================================
# STRIPE PRICE IDS — plan names match the plan limits page
# (packages/ui/src/app/pricing/page.tsx)
# ============================================================================
# One Stripe price per plan tier and interval. Amounts are whatever the
# operator configures in Stripe (Dashboard → Products); none are set here.

# Monthly Plans
STRIPE_PRICE_ID_STARTER = os.getenv("STRIPE_PRICE_ID_STARTER")
STRIPE_PRICE_ID_GROWTH = os.getenv("STRIPE_PRICE_ID_GROWTH")
STRIPE_PRICE_ID_BUSINESS = os.getenv("STRIPE_PRICE_ID_BUSINESS")
STRIPE_PRICE_ID_ENTERPRISE = os.getenv("STRIPE_PRICE_ID_ENTERPRISE")

# Annual Plans
STRIPE_PRICE_ID_STARTER_YEARLY = os.getenv("STRIPE_PRICE_ID_STARTER_YEARLY")
STRIPE_PRICE_ID_GROWTH_YEARLY = os.getenv("STRIPE_PRICE_ID_GROWTH_YEARLY")
STRIPE_PRICE_ID_BUSINESS_YEARLY = os.getenv("STRIPE_PRICE_ID_BUSINESS_YEARLY")
STRIPE_PRICE_ID_ENTERPRISE_YEARLY = os.getenv("STRIPE_PRICE_ID_ENTERPRISE_YEARLY")

# Usage-based billing for overages (Enterprise)
STRIPE_USAGE_PRICE_ID = os.getenv("STRIPE_USAGE_PRICE_ID")

# Strict webhook security settings
MAX_WEBHOOK_AGE_SECONDS = 300  # 5 minutes (matches Stripe signature tolerance)
WEBHOOK_IDEMPOTENCY_TTL = 604800  # 7 days (Stripe retries up to 3 days)

# Frontend URL for redirects
FRONTEND_URL = os.getenv("FRONTEND_URL") or os.getenv("NEXT_PUBLIC_FRONTEND_URL") or "http://localhost:3000"

# Stripe is optional: without credentials the Stripe endpoints answer 503
# (see billing_gate.py) and everything read from Postgres keeps working.
if not billing_enabled():
    log.info("billing_disabled", reason="STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set")
else:
    if not all([STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_GROWTH, STRIPE_PRICE_ID_BUSINESS, STRIPE_PRICE_ID_ENTERPRISE]):
        log.warn("billing_startup_warning", message="Monthly Stripe Price IDs not fully configured. Billing endpoints may fail.")
    if not all([STRIPE_PRICE_ID_STARTER_YEARLY, STRIPE_PRICE_ID_GROWTH_YEARLY, STRIPE_PRICE_ID_BUSINESS_YEARLY, STRIPE_PRICE_ID_ENTERPRISE_YEARLY]):
        log.warn("billing_startup_warning", message="Annual Stripe Price IDs not configured. Annual billing will not be available.")

# ============================================================================
# PLAN LIMITS — keep in sync with packages/ui/src/app/pricing/page.tsx
# ============================================================================
# Plan tiers are quota levels. The operator assigns a tier to an
# organization in the database; Stripe, when enabled, can set it too.
# If you change these, update the plan limits page AND db/schema.sql.
#
# - Free: default for new organizations
# - Starter / Growth / Business: progressively higher quotas
# - Enterprise: no request cap
# ============================================================================

PLAN_LIMITS = {
    "free": {
        "requests": 100_000,      # 100K/mo
        "projects": 1,
        "agents": 3,
        "team_members": 1,
        "sla": None,              # No SLA guarantee
        "support": "community",
    },
    "starter": {
        "requests": 500_000,      # 500K/mo
        "projects": 5,
        "agents": 10,
        "team_members": 3,
        "sla": None,              # No SLA (email support 48h)
        "support": "email_48h",
    },
    "growth": {
        "requests": 2_000_000,    # 2M/mo
        "projects": 20,
        "agents": 50,
        "team_members": 10,
        "sla": "best-effort (no formal SLA yet)",  # previously 99.5% uptime target
        "support": "priority_24h",
    },
    "business": {
        "requests": 10_000_000,   # 10M/mo
        "projects": None,         # Unlimited
        "agents": None,           # Unlimited
        "team_members": 50,
        "sla": "best-effort (no formal SLA yet)",  # previously 99.9% uptime target
        "support": "slack_dedicated",
    },
    "enterprise": {
        "requests": None,         # Unlimited
        "projects": None,
        "agents": None,
        "team_members": None,
        "sla": "best-effort (no formal SLA yet)",  # no formal SLA; response times vary
        "support": "dedicated_csm",
    }
}

# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/billing", tags=["billing"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CreateCheckoutSessionRequest(BaseModel):
    """
    Plan names match the plan limits page (packages/ui/src/app/pricing/page.tsx).
    Valid plans: starter, growth, business, enterprise
    (free tier has no checkout - it's the default)
    """
    plan: str = Field(..., pattern="^(starter|growth|business|enterprise)$")
    interval: str = Field(default="month", pattern="^(month|year)$")


class SubscriptionStatusResponse(BaseModel):
    """
    Keep in sync with the frontend SubscriptionStatus interface.
    Frontend: packages/ui/src/hooks/use-subscription.ts:SubscriptionStatus
    
    All fields are Optional to handle users without subscriptions gracefully.
    """
    has_subscription: bool
    plan_tier: Optional[str] = None
    status: Optional[str] = None  # 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
    requests_used: Optional[int] = None
    requests_limit: Optional[int] = None
    usage_percentage: Optional[float] = None
    current_period_end: Optional[str] = None  # ISO 8601 datetime string
    
    # DB fields exposed to the UI
    cancel_at_period_end: bool = False  # True if subscription will cancel at period end
    trial_end: Optional[str] = None  # ISO 8601 datetime string (null if not in trial)
    billing_interval: Optional[str] = None  # 'month' | 'year' (for UI display)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_or_create_stripe_customer(user_id: str) -> stripe.Customer:
    """
    Get existing Stripe customer or create new one.
    Stripe customer ID is stored in subscriptions table.
    """
    try:
        # Check if customer exists in database
        result = await resources.supabase.table("subscriptions").select("stripe_customer_id").eq("user_id", user_id).limit(1).execute()
        
        if result.data and result.data[0].get("stripe_customer_id"):
            # Return existing customer
            customer_id = result.data[0]["stripe_customer_id"]
            return stripe.Customer.retrieve(customer_id)
        
        # Get user email from profiles
        profile_result = await resources.supabase.table("profiles").select("email, full_name").eq("id", user_id).single().execute()
        
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        email = profile_result.data.get("email")
        name = profile_result.data.get("full_name", "Unknown")
        
        # Create new Stripe customer
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={
                "user_id": user_id
            }
        )
        
        log.info("stripe_customer_created", user_id=user_id, customer_id=customer.id)
        return customer
        
    except Exception as e:
        log.error("stripe_customer_creation_failed", user_id=user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create Stripe customer")


async def log_billing_event(
    user_id: str,
    subscription_id: Optional[str],
    event_type: str,
    stripe_event_id: Optional[str] = None,
    amount_cents: Optional[int] = None,
    currency: str = "usd",
    metadata: dict = None
):
    """
    Log billing event to audit log for compliance and debugging.
    This is an immutable log - events are never deleted.
    """
    try:
        await resources.supabase.table("billing_audit_log").insert({
            "user_id": user_id,
            "subscription_id": subscription_id,
            "event_type": event_type,
            "stripe_event_id": stripe_event_id,
            "amount_cents": amount_cents,
            "currency": currency,
            "metadata": json.dumps(metadata or {})
        }).execute()
        
        log.info("billing_event_logged", user_id=user_id, event_type=event_type)
        
    except Exception as e:
        log.error("billing_event_log_failed", user_id=user_id, event_type=event_type, exc_info=True)


# ============================================================================
# WEBHOOK HANDLERS
# ============================================================================

async def handle_checkout_session_completed(session: dict):
    """
    Handle checkout.session.completed event.
    
    CRITICAL: This is the PRIMARY entry point for new subscriptions.
    When user completes Stripe Checkout, this fires BEFORE subscription.created.
    
    For subscription checkouts:
    - Creates/updates subscription record in database
    - Links Stripe customer_id to user
    
    SECURITY:
    - user_id comes from session metadata (set during checkout creation)
    - Only processes 'subscription' mode sessions
    
    RELIABILITY:
    - Uses UPSERT to handle race conditions with subscription.created event
    """
    mode = session.get("mode")
    if mode != "subscription":
        log.info("checkout_session_non_subscription", mode=mode, session_id=session["id"])
        return
    
    user_id = session.get("metadata", {}).get("user_id")
    if not user_id:
        log.error("checkout_session_missing_user_id", 
                 session_id=session["id"],
                 metadata=session.get("metadata"))
        return
    
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    plan_tier = session.get("metadata", {}).get("plan_tier", "starter")
    interval = session.get("metadata", {}).get("interval", "month")
    
    log.info("checkout_session_processing",
             user_id=user_id,
             subscription_id=subscription_id,
             plan_tier=plan_tier)
    
    try:
        # Fetch full subscription details from Stripe
        stripe_sub = stripe.Subscription.retrieve(subscription_id)
        
        # Build subscription data
        subscription_data = {
            "user_id": user_id,
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
            "plan_tier": plan_tier,
            "status": stripe_sub.status,  # Usually 'active' or 'trialing'
            "interval": interval,
            "current_period_start": datetime.fromtimestamp(stripe_sub.current_period_start, timezone.utc).isoformat(),
            "current_period_end": datetime.fromtimestamp(stripe_sub.current_period_end, timezone.utc).isoformat(),
            "trial_start": datetime.fromtimestamp(stripe_sub.trial_start, timezone.utc).isoformat() if stripe_sub.trial_start else None,
            "trial_end": datetime.fromtimestamp(stripe_sub.trial_end, timezone.utc).isoformat() if stripe_sub.trial_end else None,
            "cancel_at_period_end": stripe_sub.cancel_at_period_end
        }
        
        # UPSERT: Create if not exists, update if exists
        await resources.supabase.table("subscriptions").upsert(
            subscription_data,
            on_conflict="stripe_subscription_id"
        ).execute()
        
        log.info("checkout_subscription_upserted",
                user_id=user_id,
                subscription_id=subscription_id)
        
        # Log billing event
        await log_billing_event(
            user_id=user_id,
            subscription_id=subscription_id,
            event_type="checkout_completed",
            metadata={
                "plan_tier": plan_tier,
                "interval": interval,
                "session_id": session["id"],
                "amount_total": session.get("amount_total"),
                "currency": session.get("currency")
            }
        )
        
        log.info("checkout_session_completed", 
                user_id=user_id, 
                subscription_id=subscription_id, 
                plan_tier=plan_tier,
                interval=interval)
        
    except Exception as e:
        log.error("checkout_session_handler_failed", 
                 user_id=user_id, 
                 session_id=session["id"],
                 error=str(e),
                 exc_info=True)


async def handle_subscription_created(subscription: dict):
    """
    Handle customer.subscription.created event.
    Creates or updates subscription record in database.
    
    CRITICAL: Uses UPSERT to handle race conditions where checkout.session.completed
    may have already created the subscription record.
    """
    user_id = subscription.get("metadata", {}).get("user_id")
    if not user_id:
        log.error("subscription_created_missing_user_id", 
                 subscription_id=subscription["id"],
                 metadata=subscription.get("metadata"))
        return
    
    log.info("subscription_created_processing", 
             user_id=user_id, 
             subscription_id=subscription["id"],
             status=subscription.get("status"))
    
    try:
        # Build subscription data
        subscription_data = {
            "user_id": user_id,
            "stripe_customer_id": subscription["customer"],
            "stripe_subscription_id": subscription["id"],
            "plan_tier": subscription.get("metadata", {}).get("plan_tier", "starter"),
            "status": subscription["status"],
            "interval": subscription.get("metadata", {}).get("interval", "month"),
            "current_period_start": datetime.fromtimestamp(subscription["current_period_start"], timezone.utc).isoformat(),
            "current_period_end": datetime.fromtimestamp(subscription["current_period_end"], timezone.utc).isoformat(),
            "trial_start": datetime.fromtimestamp(subscription["trial_start"], timezone.utc).isoformat() if subscription.get("trial_start") else None,
            "trial_end": datetime.fromtimestamp(subscription["trial_end"], timezone.utc).isoformat() if subscription.get("trial_end") else None,
            "cancel_at_period_end": subscription.get("cancel_at_period_end", False)
        }
        
        # UPSERT: Create if not exists, update if exists
        # Uses stripe_subscription_id as unique constraint
        await resources.supabase.table("subscriptions").upsert(
            subscription_data, 
            on_conflict="stripe_subscription_id"
        ).execute()
        
        log.info("subscription_upserted_to_db", 
                user_id=user_id, 
                subscription_id=subscription["id"])
        
        # Log billing event
        await log_billing_event(
            user_id=user_id,
            subscription_id=subscription["id"],
            event_type="subscription_created",
            metadata={"plan_tier": subscription.get("metadata", {}).get("plan_tier")}
        )
        
        log.info("subscription_created_complete", user_id=user_id, subscription_id=subscription["id"])
        
    except Exception as e:
        log.error("subscription_created_handler_failed", 
                 user_id=user_id, 
                 subscription_id=subscription["id"],
                 error=str(e),
                 exc_info=True)


async def handle_subscription_updated(subscription: dict):
    """
    Handle customer.subscription.updated event.
    Updates subscription status, period, and plan changes.
    """
    try:
        # Update subscription
        await resources.supabase.table("subscriptions").update({
            "status": subscription["status"],
            "plan_tier": subscription["metadata"].get("plan_tier"),
            "current_period_start": datetime.fromtimestamp(subscription["current_period_start"], timezone.utc).isoformat(),
            "current_period_end": datetime.fromtimestamp(subscription["current_period_end"], timezone.utc).isoformat(),
            "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
            "canceled_at": datetime.fromtimestamp(subscription["canceled_at"], timezone.utc).isoformat() if subscription.get("canceled_at") else None
        }).eq("stripe_subscription_id", subscription["id"]).execute()
        
        # Get user_id for logging
        result = await resources.supabase.table("subscriptions").select("user_id").eq("stripe_subscription_id", subscription["id"]).single().execute()
        user_id = result.data["user_id"] if result.data else None
        
        if user_id:
            await log_billing_event(
                user_id=user_id,
                subscription_id=subscription["id"],
                event_type="subscription_updated",
                metadata={"status": subscription["status"]}
            )
        
        log.info("subscription_updated", subscription_id=subscription["id"])
        
    except Exception as e:
        log.error("subscription_updated_handler_failed", subscription_id=subscription["id"], exc_info=True)


async def handle_subscription_deleted(subscription: dict):
    """
    Handle customer.subscription.deleted event.
    Marks subscription as canceled AND deactivates all API keys.
    
    Revokes access as soon as a subscription is canceled.
    """
    try:
        # Get user_id and subscription details
        result = await resources.supabase.table("subscriptions").select("user_id").eq("stripe_subscription_id", subscription["id"]).single().execute()
        user_id = result.data["user_id"] if result.data else None
        
        if not user_id:
            log.error("subscription_deleted_no_user", subscription_id=subscription["id"])
            return
        
        # Update subscription status
        await resources.supabase.table("subscriptions").update({
            "status": "canceled",
            "canceled_at": datetime.now(timezone.utc).isoformat()
        }).eq("stripe_subscription_id", subscription["id"]).execute()
        
        # CRITICAL: Get user's organization(s) and deactivate ALL API keys
        orgs_result = await resources.supabase.table("organizations").select("id").eq("owner_user_id", user_id).execute()
        
        if orgs_result.data:
            for org in orgs_result.data:
                org_id = org["id"]
                
                # Get all projects in organization
                projects_result = await resources.supabase.table("projects").select("id").eq("organization_id", org_id).execute()
                
                if projects_result.data:
                    project_ids = [p["id"] for p in projects_result.data]
                    
                    # Deactivate ALL API keys in organization
                    for project_id in project_ids:
                        await resources.supabase.table("api_keys").update({
                            "is_active": False,
                            "deactivated_reason": "Subscription canceled",
                            "deactivated_at": datetime.now(timezone.utc).isoformat()
                        }).eq("project_id", project_id).execute()
                        
                        log.info("api_keys_deactivated_subscription_canceled", 
                                user_id=user_id, 
                                organization_id=org_id, 
                                project_id=project_id)
        
        # CRITICAL: Clear Redis cache to prevent cached key usage
        # This ensures deactivation is immediate
        # NOTE: resources.redis is imported from core at top of file
        
        if resources.redis:
            # Get all cached keys
            cached_keys = await resources.redis.keys("api_key:*")
            
            for key in cached_keys:
                try:
                    cached_data = await resources.redis.get(key)
                    if cached_data:
                        data = json.loads(cached_data)
                        # Check if key belongs to this user
                        if data.get("user_id") == user_id:
                            await resources.redis.delete(key)
                            log.info("cache_cleared_subscription_canceled", key=key, user_id=user_id)
                except Exception as cache_error:
                    log.warning("cache_clear_failed", key=key, error=str(cache_error))
        
        # Log billing event
        await log_billing_event(
            user_id=user_id,
            subscription_id=subscription["id"],
            event_type="subscription_deleted",
            metadata={"api_keys_deactivated": True}
        )
        
        log.info("subscription_deleted_complete", subscription_id=subscription["id"], user_id=user_id)
        
    except Exception as e:
        log.error("subscription_deleted_handler_failed", subscription_id=subscription["id"], exc_info=True)


async def handle_payment_succeeded(invoice: dict):
    """
    Handle invoice.payment_succeeded event.
    Logs successful payment for audit trail.
    """
    try:
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return
        
        # Get user_id
        result = await resources.supabase.table("subscriptions").select("user_id").eq("stripe_subscription_id", subscription_id).single().execute()
        user_id = result.data["user_id"] if result.data else None
        
        if user_id:
            await log_billing_event(
                user_id=user_id,
                subscription_id=subscription_id,
                event_type="payment_succeeded",
                amount_cents=invoice.get("amount_paid"),
                currency=invoice.get("currency", "usd"),
                metadata={
                    "invoice_id": invoice["id"],
                    "invoice_number": invoice.get("number")
                }
            )
        
        log.info("payment_succeeded", subscription_id=subscription_id, amount=invoice.get("amount_paid"))
        
    except Exception as e:
        log.error("payment_succeeded_handler_failed", invoice_id=invoice.get("id"), exc_info=True)


async def send_payment_failure_email(user_email: str, invoice_url: str, amount_due: int, currency: str = "usd"):
    """
    Send a payment-failed (dunning) email with the Stripe invoice link.
    
    Args:
        user_email: Customer email address
        invoice_url: Stripe hosted invoice URL for payment retry
        amount_due: Amount in cents
        currency: Currency code (default: "usd")
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
    
    if not SENDGRID_API_KEY:
        log.error("sendgrid_not_configured", 
                 message="SENDGRID_API_KEY not set. Cannot send dunning emails.",
                 severity="high")
        return False
    
    # Format amount for display
    amount_display = f"${amount_due / 100:.2f}" if currency == "usd" else f"{amount_due / 100:.2f} {currency.upper()}"
    
    # Professional HTML email template (mobile-responsive)
    email_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
            .container {{ max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); padding: 40px 30px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 24px; font-weight: 600; }}
            .content {{ padding: 40px 30px; }}
            .alert-box {{ background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px; }}
            .alert-box h2 {{ color: #991b1b; margin: 0 0 8px 0; font-size: 18px; }}
            .alert-box p {{ color: #7f1d1d; margin: 0; font-size: 14px; }}
            .info-box {{ background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 6px; margin: 24px 0; }}
            .info-box h3 {{ margin: 0 0 12px 0; font-size: 16px; color: #1f2937; }}
            .info-box ul {{ margin: 8px 0; padding-left: 20px; }}
            .info-box li {{ margin: 6px 0; color: #4b5563; }}
            .cta-button {{ display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; }}
            .cta-button:hover {{ background: linear-gradient(135deg, #6d28d9 0%, #2563eb 100%); }}
            .footer {{ background: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; }}
            .amount {{ font-size: 28px; font-weight: 700; color: #7c3aed; margin: 16px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔔 Payment Action Required</h1>
            </div>
            
            <div class="content">
                <div class="alert-box">
                    <h2>Your Payment Failed</h2>
                    <p>We were unable to process your payment for Oxy Engine.</p>
                </div>
                
                <p>Hello,</p>
                
                <p>We attempted to charge your payment method for your Oxy Engine subscription, but the transaction failed.</p>
                
                <div class="amount">Amount Due: {amount_display}</div>
                
                <div class="info-box">
                    <h3>What Happens Next?</h3>
                    <ul>
                        <li><strong>Automatic Retry:</strong> We'll retry your payment in 3 days</li>
                        <li><strong>Service Continuity:</strong> Your service remains active during retry period</li>
                        <li><strong>Final Attempt:</strong> After 3 failed attempts, your subscription will be suspended</li>
                    </ul>
                </div>
                
                <p><strong>Why might this have happened?</strong></p>
                <ul>
                    <li>Insufficient funds in your account</li>
                    <li>Expired or canceled credit card</li>
                    <li>Bank declined the transaction</li>
                    <li>Billing address mismatch</li>
                </ul>
                
                <p style="margin-top: 32px;"><strong>Action Required:</strong></p>
                <p>Update your payment method now to avoid service interruption.</p>
                
                <div style="text-align: center; margin: 32px 0;">
                    <a href="{invoice_url or FRONTEND_URL + '/settings?tab=billing'}" class="cta-button">
                        Update Payment Method →
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 32px;">
                    If you believe this is an error or need assistance, please contact our support team at 
                    <a href="mailto:{BILLING_EMAIL}" style="color: #7c3aed;">{BILLING_EMAIL}</a>
                </p>
            </div>
            
            <div class="footer">
                <p><strong>Oxy Engine</strong> - AI Control Plane</p>
                <p>This is an automated notification. Please do not reply to this email.</p>
                <p style="margin-top: 12px;">
                    <a href="{FRONTEND_URL}/unsubscribe" style="color: #6b7280; text-decoration: none;">Unsubscribe</a> | 
                    <a href="{FRONTEND_URL}/privacy" style="color: #6b7280; text-decoration: none;">Privacy Policy</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        # SendGrid API v3 request
        response = await resources.http_client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {SENDGRID_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "personalizations": [{
                    "to": [{"email": user_email}],
                    "subject": "Payment Failed - Action Required"
                }],
                "from": {
                    "email": BILLING_EMAIL,
                    "name": "Oxy Engine Billing"
                },
                "content": [{
                    "type": "text/html",
                    "value": email_html
                }],
                # SendGrid categories for tracking
                "categories": ["dunning", "payment_failed"],
                # Track opens and clicks
                "tracking_settings": {
                    "click_tracking": {"enable": True},
                    "open_tracking": {"enable": True}
                }
            },
            timeout=10.0  # 10 second timeout for email delivery
        )
        
        if response.status_code == 202:
            log.info("dunning_email_sent", 
                    email=user_email, 
                    amount=amount_display,
                    message="Payment failure email sent successfully via SendGrid")
            return True
        else:
            log.error("sendgrid_api_error", 
                     status_code=response.status_code,
                     response=response.text,
                     email=user_email)
            return False
            
    except Exception as e:
        log.error("dunning_email_failed", 
                 email=user_email, 
                 error=str(e),
                 exc_info=True,
                 message="Failed to send payment failure email")
        return False


async def handle_payment_failed(invoice: dict):
    """
    Handle invoice.payment_failed event.
    Logs failed payment and updates subscription status.
    CRITICAL: This triggers dunning process (Stripe Smart Retries handles retries).
    
    Also sends a dunning email with the invoice link.
    
    DUNNING LOGIC:
    - Stripe automatically retries failed payments (Smart Retries enabled in Dashboard)
    - We send professional email notification with payment link
    - After max retries (configurable in Stripe), subscription moves to 'unpaid'
    """
    try:
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return
        
        # Update subscription to past_due
        await resources.supabase.table("subscriptions").update({
            "status": "past_due"
        }).eq("stripe_subscription_id", subscription_id).execute()
        
        # Get user_id and email
        result = await resources.supabase.table("subscriptions").select("user_id, profiles:user_id(email)").eq("stripe_subscription_id", subscription_id).single().execute()
        user_id = result.data["user_id"] if result.data else None
        user_email = result.data.get("profiles", {}).get("email") if result.data else None
        
        if user_id and user_email:
            # Send dunning email
            invoice_url = invoice.get("hosted_invoice_url")  # Stripe hosted invoice page
            amount_due = invoice.get("amount_due", 0)
            currency = invoice.get("currency", "usd")
            
            email_sent = await send_payment_failure_email(
                user_email=user_email,
                invoice_url=invoice_url,
                amount_due=amount_due,
                currency=currency
            )
            
            # Log billing event with email delivery status
            await log_billing_event(
                user_id=user_id,
                subscription_id=subscription_id,
                event_type="payment_failed",
                amount_cents=amount_due,
                currency=currency,
                metadata={
                    "invoice_id": invoice["id"],
                    "attempt_count": invoice.get("attempt_count"),
                    "next_payment_attempt": invoice.get("next_payment_attempt"),
                    "dunning_email_sent": email_sent,
                    "invoice_url": invoice_url
                }
            )
        
        log.warn("payment_failed", 
                subscription_id=subscription_id, 
                amount=invoice.get("amount_due"),
                email_sent=email_sent if user_email else False)
        
    except Exception as e:
        log.error("payment_failed_handler_failed", invoice_id=invoice.get("id"), exc_info=True)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/create-checkout-session", dependencies=[Depends(require_billing)])
async def create_checkout_session(
    body: CreateCheckoutSessionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create Stripe Checkout session for new subscription.
    
    Plans: starter, growth, business, enterprise (names match the plan limits
    page). Each maps to the Stripe price ID configured for it; amounts live in Stripe.
    
    Returns checkout URL that redirects user to Stripe payment page.
    """
    plan = body.plan
    interval = body.interval  # "month" or "year"
    
    # Price IDs keyed by the plan names used in the UI
    if interval == "year":
        price_ids = {
            "starter": STRIPE_PRICE_ID_STARTER_YEARLY,
            "growth": STRIPE_PRICE_ID_GROWTH_YEARLY,
            "business": STRIPE_PRICE_ID_BUSINESS_YEARLY,
            "enterprise": STRIPE_PRICE_ID_ENTERPRISE_YEARLY
        }
    else:  # Default to monthly
        price_ids = {
            "starter": STRIPE_PRICE_ID_STARTER,
            "growth": STRIPE_PRICE_ID_GROWTH,
            "business": STRIPE_PRICE_ID_BUSINESS,
            "enterprise": STRIPE_PRICE_ID_ENTERPRISE
        }
    
    if plan not in price_ids or not price_ids[plan]:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid plan or Stripe price ID not configured for '{plan}' ({interval}ly)"
        )
    
    try:
        # Get or create Stripe customer
        customer = await get_or_create_stripe_customer(user_id)
        
        # Check if user already has active subscription
        existing = await resources.supabase.table("subscriptions").select("id, status").eq("user_id", user_id).eq("status", "active").limit(1).execute()
        
        if existing.data:
            raise HTTPException(
                status_code=400, 
                detail="You already have an active subscription. Cancel it first to start a different plan."
            )
        
        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer.id,
            mode="subscription",
            line_items=[{
                "price": price_ids[plan],
                "quantity": 1
            }],
            success_url=f"{FRONTEND_URL}/dashboard?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/pricing",
            metadata={
                "user_id": user_id,
                "plan_tier": plan,
                "interval": interval  # Track billing interval
            },
            subscription_data={
                "metadata": {
                    "user_id": user_id,
                    "plan_tier": plan,
                    "interval": interval
                }
                # No trial period; the free tier is the default plan
            }
        )
        
        log.info("checkout_session_created", 
                user_id=user_id, 
                plan=plan, 
                interval=interval,
                session_id=session.id,
                annual=interval == "year")
        
        return {
            "checkout_url": session.url, 
            "session_id": session.id,
            "interval": interval
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("checkout_session_creation_failed", 
                 user_id=user_id, 
                 plan=plan, 
                 interval=interval,
                 exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/webhook", dependencies=[Depends(require_billing)])
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint.
    
    CRITICAL: This endpoint MUST verify webhook signatures to prevent forgery.
    Stripe sends events here when subscriptions change, payments succeed/fail, etc.
    
    IDEMPOTENCY: Uses Redis to track processed event IDs and prevent duplicate processing.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        log.error("stripe_webhook_missing_signature")
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    
    try:
        # Verify webhook signature with timeout
        # Stripe signatures are valid for 5 minutes (300 seconds)
        event = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: stripe.Webhook.construct_event(
                    payload, sig_header, STRIPE_WEBHOOK_SECRET,
                    tolerance=300  # 5 minutes tolerance (Stripe default)
                )
            ),
            timeout=5.0  # 5 seconds max for signature verification
        )
    except asyncio.TimeoutError:
        log.error("stripe_webhook_verification_timeout")
        raise HTTPException(status_code=408, detail="Webhook verification timeout")
    except ValueError as e:
        log_error_safe(log, "stripe_webhook_invalid_payload", e)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        log_error_safe(log, "stripe_webhook_invalid_signature", e)
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle event
    event_type = event["type"]
    event_data = event["data"]["object"]
    event_id = event["id"]
    event_created = event.get("created", 0)  # Unix timestamp
    
    # Strict timestamp validation to prevent replay attacks
    # Reject events older than 5 minutes (matches Stripe signature tolerance)
    import time
    current_timestamp = int(time.time())
    event_age_seconds = current_timestamp - event_created
    
    if event_age_seconds > MAX_WEBHOOK_AGE_SECONDS:
        log.error("stripe_webhook_too_old", 
            event_id=event_id, 
            event_age_seconds=event_age_seconds,
            event_type=event_type,
            severity="CRITICAL_REPLAY_ATTEMPT"  # Alert security team
        )
        raise HTTPException(
            status_code=400, 
            detail=f"Webhook too old ({event_age_seconds}s > {MAX_WEBHOOK_AGE_SECONDS}s)"
        )
    
    # Idempotency key includes event_created to prevent collisions
    # Stripe may send the same webhook multiple times if our response is slow
    idempotency_key = f"stripe_event:{event_id}:{event_created}"
    if await resources.redis.exists(idempotency_key):
        log.info("duplicate_webhook_ignored", event_id=event_id, event_type=event_type)
        return {"status": "duplicate_ignored", "event_id": event_id}
    
    # Mark event as processed (7 day TTL - Stripe retries up to 3 days)
    await resources.redis.setex(idempotency_key, WEBHOOK_IDEMPOTENCY_TTL, "processed")
    
    log.info("stripe_webhook_received", event_type=event_type, event_id=event_id)
    
    try:
        # Route to appropriate handler
        # CRITICAL: checkout.session.completed is the ENTRY POINT for new subscriptions
        if event_type == "checkout.session.completed":
            await handle_checkout_session_completed(event_data)
        
        elif event_type == "customer.subscription.created":
            await handle_subscription_created(event_data)
        
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(event_data)
        
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(event_data)
        
        elif event_type == "invoice.payment_succeeded":
            await handle_payment_succeeded(event_data)
        
        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(event_data)
        
        else:
            log.info("stripe_webhook_unhandled_event", event_type=event_type)
    
    except Exception as e:
        log.error("stripe_webhook_handler_failed", event_type=event_type, exc_info=True)
        # Return 200 to prevent Stripe from retrying (we logged the error)
        return {"status": "error_logged"}
    
    return {"status": "success"}


@router.get("/subscription-status")
async def get_subscription_status(user_id: str = Depends(get_current_user_id)) -> SubscriptionStatusResponse:
    """
    Get current user's subscription status and usage.
    
    Response must match the frontend SubscriptionStatus interface exactly.
    
    Returns:
    - Subscription plan and status
    - Current usage vs. limits
    - Billing period dates
    - NEW: cancel_at_period_end, trial_end, billing_interval
    """
    try:
        # Get subscription with usage
        # rpc() is async def that returns SupabaseResponse directly (no .execute() needed)
        result = await resources.supabase.rpc("fn_get_subscription_status", {"p_user_id": user_id})
        
        if not result.data or not result.data.get("subscription"):
            return SubscriptionStatusResponse(
                has_subscription=False,
                plan_tier=None,
                status=None,
                requests_used=None,
                requests_limit=None,
                usage_percentage=None,
                current_period_end=None,
                cancel_at_period_end=False,
                trial_end=None,
                billing_interval=None
            )
        
        subscription = result.data["subscription"]
        usage = result.data.get("usage", {})
        limits = result.data.get("limits", {})
        
        requests_used = usage.get("requests_count", 0)
        requests_limit = limits.get("requests_limit")
        
        usage_percentage = None
        if requests_limit and requests_limit > 0:
            usage_percentage = round((requests_used / requests_limit) * 100, 2)
        
        # Extract the remaining subscription fields
        cancel_at_period_end = subscription.get("cancel_at_period_end", False)
        trial_end = subscription.get("trial_end")  # Already ISO 8601 string or None
        
        # Determine billing interval from metadata or default to 'month'
        # This is stored in Stripe subscription metadata during checkout
        billing_interval = subscription.get("billing_interval") or subscription.get("metadata", {}).get("interval", "month")
        
        return SubscriptionStatusResponse(
            has_subscription=True,
            plan_tier=subscription["plan_tier"],
            status=subscription["status"],
            requests_used=requests_used,
            requests_limit=requests_limit,
            usage_percentage=usage_percentage,
            current_period_end=subscription["current_period_end"],
            cancel_at_period_end=cancel_at_period_end,
            trial_end=trial_end,
            billing_interval=billing_interval
        )
        
    except Exception as e:
        log.error("subscription_status_fetch_failed", user_id=user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch subscription status")


@router.post("/cancel-subscription", dependencies=[Depends(require_billing)])
async def cancel_subscription(user_id: str = Depends(get_current_user_id)):
    """
    Cancel user's subscription at end of billing period.
    
    Subscription remains active until current_period_end.
    User retains access until then.
    """
    try:
        # Get subscription
        result = await resources.supabase.table("subscriptions").select("stripe_subscription_id, status").eq("user_id", user_id).eq("status", "active").single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        stripe_subscription_id = result.data["stripe_subscription_id"]
        
        # Cancel at period end (user retains access)
        stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        # Update database
        await resources.supabase.table("subscriptions").update({
            "cancel_at_period_end": True
        }).eq("stripe_subscription_id", stripe_subscription_id).execute()
        
        # Log event
        await log_billing_event(
            user_id=user_id,
            subscription_id=stripe_subscription_id,
            event_type="subscription_canceled"
        )
        
        log.info("subscription_canceled", user_id=user_id)
        
        return {"status": "success", "message": "Subscription will cancel at end of billing period"}
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("subscription_cancel_failed", user_id=user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")


@router.post("/reactivate-subscription", dependencies=[Depends(require_billing)])
async def reactivate_subscription(user_id: str = Depends(get_current_user_id)):
    """
    Reactivate a subscription that was scheduled for cancellation.
    
    Only works if subscription hasn't ended yet (cancel_at_period_end = true).
    """
    try:
        # Get subscription
        result = await resources.supabase.table("subscriptions").select("stripe_subscription_id, cancel_at_period_end").eq("user_id", user_id).eq("status", "active").single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        if not result.data["cancel_at_period_end"]:
            raise HTTPException(status_code=400, detail="Subscription is not scheduled for cancellation")
        
        stripe_subscription_id = result.data["stripe_subscription_id"]
        
        # Reactivate
        stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=False
        )
        
        # Update database
        await resources.supabase.table("subscriptions").update({
            "cancel_at_period_end": False,
            "canceled_at": None
        }).eq("stripe_subscription_id", stripe_subscription_id).execute()
        
        log.info("subscription_reactivated", user_id=user_id)
        
        return {"status": "success", "message": "Subscription reactivated"}
        
    except HTTPException:
        raise
    except Exception as e:
        log.error("subscription_reactivation_failed", user_id=user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reactivate subscription")


# ============================================================================
# USAGE REPORTING (for metered billing)
# ============================================================================

async def report_usage_to_stripe(subscription_id: str, quantity: int):
    """
    Report API usage to Stripe for metered billing.
    
    This is called periodically (e.g., daily) to report usage for accounts
    with usage-based billing (Enterprise plan overages).
    
    Note: This is optional for MVP. Can be added later for granular billing.
    """
    try:
        # Get Stripe subscription
        subscription = stripe.Subscription.retrieve(subscription_id)
        
        # Find usage item
        usage_item = None
        for item in subscription["items"]["data"]:
            if item["price"]["id"] == STRIPE_USAGE_PRICE_ID:
                usage_item = item
                break
        
        if not usage_item:
            log.warn("usage_item_not_found", subscription_id=subscription_id)
            return
        
        # Create usage record
        stripe.SubscriptionItem.create_usage_record(
            usage_item["id"],
            quantity=quantity,
            timestamp=int(datetime.now(timezone.utc).timestamp()),
            action="set"  # "set" replaces, "increment" adds
        )
        
        log.info("usage_reported_to_stripe", subscription_id=subscription_id, quantity=quantity)
        
    except Exception as e:
        log.error("stripe_usage_report_failed", subscription_id=subscription_id, exc_info=True)

