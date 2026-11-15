"""
DUNNING EMAIL WORKER
====================
Automated payment recovery email sequences.

Schedule: Run daily via cron (0 9 * * *)

Email Sequence:
- Day 1: Friendly reminder (payment failed)
- Day 3: Second notice (urgency added)
- Day 7: Final warning (account suspension imminent)
- Day 30: Account suspended

Part of the optional Stripe billing module.

Author: Oxy contributors
License: Apache 2.0
"""

import os
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader
import structlog

# Logging
log = structlog.get_logger()

# Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "alerts@example.com")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@example.com")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", os.getenv("SITE_URL", "http://localhost:3000"))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Email templates directory
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "dunning"
template_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


async def get_failed_payments_by_age(age_days: int) -> List[Dict]:
    """
    Query database for failed payments X days old.
    
    Returns list of subscriptions with:
    - user_id
    - email
    - full_name
    - plan_tier
    - amount (in cents)
    - stripe_customer_id
    - stripe_subscription_id
    - last4 (card)
    """
    query = f"""
    SELECT 
        s.user_id,
        p.email,
        p.full_name,
        s.plan_tier,
        s.amount as amount_cents,
        s.stripe_customer_id,
        s.stripe_subscription_id,
        s.updated_at
    FROM subscriptions s
    JOIN profiles p ON s.user_id = p.id
    WHERE s.status = 'past_due'
      AND DATE(s.updated_at) = CURRENT_DATE - INTERVAL '{age_days} days'
    """
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                json={"query": query},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                log.error("failed_to_query_subscriptions", 
                         status=response.status_code, 
                         error=response.text)
                return []
        except Exception as e:
            log.error("database_query_failed", error=str(e), exc_info=True)
            return []


async def send_dunning_email(
    recipient: Dict, 
    template_name: str, 
    age_days: int
) -> bool:
    """
    Send dunning email via Resend API.
    
    Returns True if successful, False otherwise.
    """
    try:
        # Load email template
        template = template_env.get_template(template_name)
        
        # Calculate amount in dollars
        amount_due = recipient.get("amount_cents", 0) / 100.0
        
        # Render email HTML
        html_content = template.render(
            full_name=recipient.get("full_name", "there"),
            plan_name=recipient.get("plan_tier", "").replace("_", " ").title(),
            amount_due=f"{amount_due:.2f}",
            last4=recipient.get("last4", "****"),
            billing_date=datetime.now(timezone.utc).strftime("%B %d, %Y"),
            dashboard_url=DASHBOARD_URL,
            support_email=SUPPORT_EMAIL,
        )
        
        # Determine subject based on age
        subjects = {
            1: "Payment Failed - Please Update Your Card",
            3: "Reminder: Payment Failed - Action Required",
            7: "🚨 Final Notice: Account Suspension in 24 Hours",
            30: "Your Oxy Engine Account Has Been Suspended"
        }
        
        subject = subjects.get(age_days, "Payment Issue - Oxy Engine")
        
        # Send via Resend API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": EMAIL_FROM,
                    "to": recipient["email"],
                    "subject": subject,
                    "html": html_content,
                    "tags": [
                        {"name": "category", "value": "dunning"},
                        {"name": "day", "value": str(age_days)}
                    ]
                },
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                log.info("dunning_email_sent", 
                        email=recipient["email"], 
                        template=template_name, 
                        day=age_days)
                return True
            else:
                log.error("dunning_email_failed", 
                         email=recipient["email"], 
                         status=response.status_code,
                         error=response.text)
                return False
                
    except Exception as e:
        log.error("send_email_exception", 
                 email=recipient.get("email", "unknown"), 
                 error=str(e), 
                 exc_info=True)
        return False


async def run_dunning_campaign():
    """
    Main dunning campaign executor.
    
    Runs email sequences for payments failed 1, 3, 7, and 30 days ago.
    
    Call this daily via cron:
    0 9 * * * cd /app/packages/engine && python -m workers.dunning_emails
    """
    log.info("dunning_campaign_started")
    
    total_sent = 0
    total_failed = 0
    
    # Day 1: Friendly reminder
    log.info("processing_day1_payments")
    day1_payments = await get_failed_payments_by_age(1)
    for payment in day1_payments:
        success = await send_dunning_email(payment, "payment_failed_day1.html", 1)
        if success:
            total_sent += 1
        else:
            total_failed += 1
    
    # Day 3: Second notice
    log.info("processing_day3_payments")
    day3_payments = await get_failed_payments_by_age(3)
    for payment in day3_payments:
        success = await send_dunning_email(payment, "payment_failed_day3.html", 3)
        if success:
            total_sent += 1
        else:
            total_failed += 1
    
    # Day 7: Final warning
    log.info("processing_day7_payments")
    day7_payments = await get_failed_payments_by_age(7)
    for payment in day7_payments:
        success = await send_dunning_email(payment, "payment_failed_day7.html", 7)
        if success:
            total_sent += 1
        else:
            total_failed += 1
    
    # Day 30: Account suspended
    log.info("processing_day30_payments")
    day30_payments = await get_failed_payments_by_age(30)
    for payment in day30_payments:
        success = await send_dunning_email(payment, "account_suspended_day30.html", 30)
        if success:
            total_sent += 1
        else:
            total_failed += 1
    
    log.info("dunning_campaign_completed", 
            total_sent=total_sent, 
            total_failed=total_failed,
            day1=len(day1_payments),
            day3=len(day3_payments),
            day7=len(day7_payments),
            day30=len(day30_payments))
    
    return {
        "sent": total_sent,
        "failed": total_failed,
        "breakdown": {
            "day1": len(day1_payments),
            "day3": len(day3_payments),
            "day7": len(day7_payments),
            "day30": len(day30_payments)
        }
    }


# CLI Entry Point
if __name__ == "__main__":
    print("🚀 Starting Dunning Email Campaign...")
    print("=" * 60)
    
    # Check configuration
    if not RESEND_API_KEY:
        print("❌ ERROR: RESEND_API_KEY not set")
        exit(1)
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ ERROR: Supabase credentials not set")
        exit(1)
    
    # Run campaign
    result = asyncio.run(run_dunning_campaign())
    
    print("=" * 60)
    print(f"✅ Campaign Complete!")
    print(f"   - Emails Sent: {result['sent']}")
    print(f"   - Failed: {result['failed']}")
    print(f"   - Day 1: {result['breakdown']['day1']} recipients")
    print(f"   - Day 3: {result['breakdown']['day3']} recipients")
    print(f"   - Day 7: {result['breakdown']['day7']} recipients")
    print(f"   - Day 30: {result['breakdown']['day30']} recipients")
    print("=" * 60)

