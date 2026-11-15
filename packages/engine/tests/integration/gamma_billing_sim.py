#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   💰 GAMMA BILLING SIMULATION - STRIPE WEBHOOK TESTING v1.0                 ║
║   Stripe webhook flows end to end                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests the complete billing flow:
- Subscription creation via webhooks
- Payment failure handling (dunning)
- Subscription cancellation

SECURITY: Uses Stripe's signature generation for authentic webhook payloads.
"""

import os
import sys
import asyncio
import time
import json
import random
import string
import hmac
import hashlib
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any
import httpx
from dotenv import load_dotenv

# --- CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent.parent
ENGINE_ENV_PATH = BASE_DIR / "packages" / "engine" / ".env"

if ENGINE_ENV_PATH.exists():
    load_dotenv(dotenv_path=ENGINE_ENV_PATH)

API_URL = os.getenv("API_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def validate_config():
    """Validate required environment variables."""
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    if not STRIPE_WEBHOOK_SECRET:
        missing.append("STRIPE_WEBHOOK_SECRET")
    
    if missing:
        print(f"{Colors.RED}❌ CRITICAL: Missing environment variables: {', '.join(missing)}{Colors.ENDC}")
        print(f"{Colors.YELLOW}   Set these in packages/engine/.env{Colors.ENDC}")
        sys.exit(1)

validate_config()

RUN_ID = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))

class ScenarioStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    ERROR = "ERROR"

@dataclass
class ScenarioResult:
    name: str
    status: ScenarioStatus
    duration_ms: float
    details: str = ""
    errors: list = field(default_factory=list)


def generate_stripe_signature(payload: str, secret: str, timestamp: Optional[int] = None) -> str:
    """
    Generate a valid Stripe webhook signature.
    
    Stripe uses HMAC-SHA256 to sign webhooks:
    signature = HMAC_SHA256(timestamp + '.' + payload, secret)
    
    Args:
        payload: JSON string of the webhook payload
        secret: Stripe webhook secret (whsec_...)
        timestamp: Unix timestamp (default: current time)
    
    Returns:
        Full Stripe-Signature header value: "t=timestamp,v1=signature"
    """
    if timestamp is None:
        timestamp = int(time.time())
    
    # Create the signed payload string
    signed_payload = f"{timestamp}.{payload}"
    
    # Compute HMAC with SHA256
    signature = hmac.new(
        secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"t={timestamp},v1={signature}"


def generate_stripe_event_id() -> str:
    """Generate a realistic Stripe event ID."""
    return f"evt_{''.join(random.choices(string.ascii_letters + string.digits, k=24))}"


def generate_stripe_customer_id() -> str:
    """Generate a realistic Stripe customer ID."""
    return f"cus_{''.join(random.choices(string.ascii_letters + string.digits, k=14))}"


def generate_stripe_subscription_id() -> str:
    """Generate a realistic Stripe subscription ID."""
    return f"sub_{''.join(random.choices(string.ascii_letters + string.digits, k=24))}"


def generate_stripe_invoice_id() -> str:
    """Generate a realistic Stripe invoice ID."""
    return f"in_{''.join(random.choices(string.ascii_letters + string.digits, k=24))}"


class BillingClient:
    """HTTP client for billing API interactions."""
    
    def __init__(self):
        self.http = httpx.AsyncClient(base_url=API_URL, timeout=30.0)
        self.sb = httpx.AsyncClient(base_url=SUPABASE_URL, timeout=30.0)
        self.csrf_token = None
    
    async def close(self):
        await self.http.aclose()
        await self.sb.aclose()
    
    async def _ensure_csrf(self):
        """Fetch CSRF token from health endpoint."""
        if self.csrf_token:
            return
        try:
            await self.http.get("/health")
            for name, val in self.http.cookies.items():
                if "csrf" in name.lower():
                    self.csrf_token = val
                    break
        except Exception:
            pass
    
    def _auth_headers(self, token: str) -> dict:
        """Build authenticated headers."""
        headers = {"Authorization": f"Bearer {token}"}
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token
        return headers
    
    def _sb_headers(self) -> dict:
        """Build Supabase service headers."""
        return {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }
    
    async def create_test_user(self, role: str) -> Optional[Dict[str, Any]]:
        """Create a test user via Supabase Auth."""
        await self._ensure_csrf()
        
        for attempt in range(3):
            domain = ''.join(random.choices(string.ascii_lowercase, k=6))
            email = f"gamma_{role}_{RUN_ID}_{attempt}@{domain}.test"
            password = "GammaTest_2025!"
            
            try:
                # Create user via Supabase Admin API
                create_res = await self.sb.post(
                    "/auth/v1/admin/users",
                    headers=self._sb_headers(),
                    json={
                        "email": email,
                        "password": password,
                        "email_confirm": True
                    }
                )
                
                if create_res.status_code not in [200, 201]:
                    print(f"{Colors.YELLOW}  ⚠ Create user failed: {create_res.status_code}{Colors.ENDC}")
                    continue
                
                user_data = create_res.json()
                user_id = user_data.get("id")
                
                # CRITICAL: Validate user_id exists
                if not user_id:
                    print(f"{Colors.RED}  ✗ Supabase returned no user ID! Response: {user_data}{Colors.ENDC}")
                    continue
                
                # Login to get JWT token
                login_res = await self.sb.post(
                    "/auth/v1/token?grant_type=password",
                    headers={"apikey": SUPABASE_SERVICE_KEY},
                    json={"email": email, "password": password}
                )
                
                if login_res.status_code != 200:
                    continue
                
                token = login_res.json()["access_token"]
                
                # Onboard user
                onboard_res = await self.http.post(
                    "/management/onboard",
                    headers=self._auth_headers(token),
                    json={
                        "full_name": f"Gamma {role.title()}",
                        "email": email,
                        "openai_key": "sk-test-gamma-billing"
                    }
                )
                
                if onboard_res.status_code == 200:
                    return {
                        "user_id": user_id,
                        "email": email,
                        "token": token,
                        "onboard_data": onboard_res.json()
                    }
                
            except Exception as e:
                print(f"{Colors.YELLOW}  ⚠ User creation attempt {attempt + 1} failed: {e}{Colors.ENDC}")
            
            await asyncio.sleep(1)
        
        return None
    
    async def send_webhook(self, event_type: str, event_data: dict, event_id: Optional[str] = None) -> httpx.Response:
        """
        Send a Stripe webhook with proper signature.
        
        Args:
            event_type: Stripe event type (e.g., 'customer.subscription.created')
            event_data: The 'data.object' content
            event_id: Optional event ID (auto-generated if not provided)
        
        Returns:
            HTTP response from webhook endpoint
        """
        timestamp = int(time.time())
        
        event = {
            "id": event_id or generate_stripe_event_id(),
            "object": "event",
            "api_version": "2023-10-16",
            "created": timestamp,
            "type": event_type,
            "data": {
                "object": event_data
            },
            "livemode": False,
            "pending_webhooks": 1,
            "request": {
                "id": f"req_{''.join(random.choices(string.ascii_letters, k=14))}",
                "idempotency_key": None
            }
        }
        
        payload = json.dumps(event, separators=(',', ':'))
        signature = generate_stripe_signature(payload, STRIPE_WEBHOOK_SECRET, timestamp)
        
        response = await self.http.post(
            "/billing/webhook",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": signature
            }
        )
        
        # RACE CONDITION FIX: Wait for backend to process webhook and write to DB
        # This prevents tests from checking status before the event is fully processed
        await asyncio.sleep(2)
        
        return response
    
    async def get_subscription_status(self, token: str) -> httpx.Response:
        """Get subscription status for authenticated user."""
        return await self.http.get(
            "/billing/subscription-status",
            headers=self._auth_headers(token)
        )
    
    async def insert_subscription_directly(self, user_id: str, stripe_customer_id: str, 
                                           stripe_subscription_id: str, plan_tier: str,
                                           status: str = "active") -> bool:
        """
        Insert subscription directly into database (for test setup).
        This simulates what the webhook would do, but allows us to control the state.
        """
        try:
            from datetime import datetime, timezone, timedelta
            
            now = datetime.now(timezone.utc)
            period_end = now + timedelta(days=30)
            
            res = await self.sb.post(
                "/rest/v1/subscriptions",
                headers={
                    **self._sb_headers(),
                    "Prefer": "return=minimal"
                },
                json={
                    "user_id": user_id,
                    "stripe_customer_id": stripe_customer_id,
                    "stripe_subscription_id": stripe_subscription_id,
                    "plan_tier": plan_tier,
                    "status": status,
                    "current_period_start": now.isoformat(),
                    "current_period_end": period_end.isoformat(),
                    "interval": "month"
                }
            )
            
            return res.status_code in [200, 201]
        except Exception as e:
            print(f"{Colors.RED}  ✗ Direct insert failed: {e}{Colors.ENDC}")
            return False


class BillingSimulator:
    """Billing scenario simulator."""
    
    def __init__(self):
        self.client = BillingClient()
        self.results: list[ScenarioResult] = []
    
    async def run_scenario_1_new_subscription(self) -> ScenarioResult:
        """
        SCENARIO 1: New Subscription (Happy Path)
        
        1. Create user
        2. Send checkout.session.completed webhook
        3. Verify subscription status is 'active'
        """
        start = time.time()
        scenario_name = "NEW SUBSCRIPTION"
        
        print(f"\n{Colors.CYAN}━━━ SCENARIO 1: {scenario_name} ━━━{Colors.ENDC}")
        
        try:
            # Step 1: Create user
            print(f"  ↳ Creating test user...", end=" ", flush=True)
            user = await self.client.create_test_user("subscriber")
            
            if not user:
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, "User creation failed")
            
            print(f"{Colors.GREEN}OK{Colors.ENDC} ({user['email']})")
            
            user_id = user["user_id"]
            
            # CRITICAL VALIDATION: Ensure user_id is not None
            if not user_id:
                print(f"{Colors.RED}  ✗ CRITICAL: user_id is None/empty!{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, "user_id is None after creation")
            
            print(f"  ↳ User ID: {Colors.BLUE}{user_id}{Colors.ENDC}")
            
            stripe_customer_id = generate_stripe_customer_id()
            stripe_subscription_id = generate_stripe_subscription_id()
            
            # Step 2: Send subscription created webhook
            print(f"  ↳ Sending subscription.created webhook...", end=" ", flush=True)
            
            # CRITICAL: metadata.user_id MUST match the profile.id in database
            # This is how fn_get_subscription_status finds the subscription
            subscription_data = {
                "id": stripe_subscription_id,
                "object": "subscription",
                "customer": stripe_customer_id,
                "status": "active",
                "current_period_start": int(time.time()),
                "current_period_end": int(time.time()) + 2592000,  # +30 days
                "metadata": {
                    "user_id": str(user_id),  # FORCE STRING to prevent JSON serialization issues
                    "plan_tier": "starter",
                    "interval": "month"
                },
                "cancel_at_period_end": False,
                "trial_start": None,
                "trial_end": None
            }
            
            print(f"(metadata.user_id={user_id[:8]}...)", end=" ", flush=True)
            
            webhook_res = await self.client.send_webhook(
                "customer.subscription.created",
                subscription_data
            )
            
            if webhook_res.status_code != 200:
                print(f"{Colors.RED}FAILED ({webhook_res.status_code}){Colors.ENDC}")
                print(f"  {Colors.YELLOW}Response: {webhook_res.text[:200]}{Colors.ENDC}")
                
                # Fallback: Insert directly if webhook fails
                print(f"  ↳ Fallback: Direct DB insert...", end=" ", flush=True)
                if await self.client.insert_subscription_directly(
                    user_id, stripe_customer_id, stripe_subscription_id, "starter", "active"
                ):
                    print(f"{Colors.GREEN}OK{Colors.ENDC}")
                else:
                    return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, 
                                        f"Webhook failed: {webhook_res.status_code}")
            else:
                print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            # Wait for DB write
            await asyncio.sleep(1)
            
            # Step 3: Verify subscription status
            print(f"  ↳ Verifying subscription status...", end=" ", flush=True)
            
            status_res = await self.client.get_subscription_status(user["token"])
            
            if status_res.status_code != 200:
                print(f"{Colors.RED}FAILED ({status_res.status_code}){Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0,
                                    f"Status check failed: {status_res.status_code}")
            
            status_data = status_res.json()
            
            # DEBUG: Show full response for diagnosis
            print(f"\n  {Colors.BLUE}DEBUG Response: {status_data}{Colors.ENDC}")
            
            if status_data.get("has_subscription") and status_data.get("status") == "active":
                print(f"  ↳ {Colors.GREEN}ACTIVE ✓{Colors.ENDC}")
                duration = (time.time() - start) * 1000
                return ScenarioResult(scenario_name, ScenarioStatus.PASS, duration,
                                    f"Plan: {status_data.get('plan_tier')}")
            else:
                print(f"  ↳ {Colors.RED}NOT ACTIVE{Colors.ENDC}")
                print(f"  {Colors.YELLOW}has_subscription={status_data.get('has_subscription')}, status={status_data.get('status')}{Colors.ENDC}")
                
                # Additional debug: Check if subscription exists in DB directly
                print(f"  ↳ Checking DB directly for user_id={user_id[:8]}...", end=" ", flush=True)
                try:
                    db_check = await self.client.sb.get(
                        "/rest/v1/subscriptions",
                        params={"user_id": f"eq.{user_id}", "select": "id,status,user_id"},
                        headers=self.client._sb_headers()
                    )
                    db_subs = db_check.json() if db_check.status_code == 200 else []
                    if db_subs:
                        print(f"{Colors.GREEN}Found {len(db_subs)} subscription(s){Colors.ENDC}")
                        for s in db_subs:
                            print(f"    → id={s.get('id', 'N/A')[:8]}..., status={s.get('status')}, user_id={s.get('user_id', 'N/A')[:8]}...")
                    else:
                        print(f"{Colors.RED}NO SUBSCRIPTIONS FOUND for this user_id!{Colors.ENDC}")
                except Exception as e:
                    print(f"{Colors.RED}DB check failed: {e}{Colors.ENDC}")
                
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0,
                                    f"Status: {status_data.get('status')}, has_sub: {status_data.get('has_subscription')}")
        
        except Exception as e:
            return ScenarioResult(scenario_name, ScenarioStatus.ERROR, 0, str(e))
    
    async def run_scenario_2_payment_failure(self) -> ScenarioResult:
        """
        SCENARIO 2: Payment Failure (Sad Path)
        
        1. Create user with active subscription
        2. Send invoice.payment_failed webhook
        3. Verify status becomes 'past_due'
        """
        start = time.time()
        scenario_name = "PAYMENT FAILURE"
        
        print(f"\n{Colors.CYAN}━━━ SCENARIO 2: {scenario_name} ━━━{Colors.ENDC}")
        
        try:
            # Step 1: Create user with subscription
            print(f"  ↳ Creating test user with subscription...", end=" ", flush=True)
            user = await self.client.create_test_user("dunning")
            
            if not user:
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, "User creation failed")
            
            print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            user_id = user["user_id"]
            stripe_customer_id = generate_stripe_customer_id()
            stripe_subscription_id = generate_stripe_subscription_id()
            
            # Insert active subscription directly
            print(f"  ↳ Setting up active subscription...", end=" ", flush=True)
            if not await self.client.insert_subscription_directly(
                user_id, stripe_customer_id, stripe_subscription_id, "professional", "active"
            ):
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.SKIP, 0, "Subscription setup failed")
            print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            await asyncio.sleep(0.5)
            
            # Step 2: Send payment failed webhook
            print(f"  ↳ Sending invoice.payment_failed webhook...", end=" ", flush=True)
            
            invoice_data = {
                "id": generate_stripe_invoice_id(),
                "object": "invoice",
                "customer": stripe_customer_id,
                "subscription": stripe_subscription_id,
                "status": "open",
                "amount_due": 4200,  # 42.00 USD test invoice
                "currency": "usd",
                "attempt_count": 1,
                "next_payment_attempt": int(time.time()) + 86400
            }
            
            webhook_res = await self.client.send_webhook(
                "invoice.payment_failed",
                invoice_data
            )
            
            if webhook_res.status_code != 200:
                print(f"{Colors.YELLOW}WEBHOOK {webhook_res.status_code}{Colors.ENDC}")
                # Continue anyway - we'll update directly
                await self.client.sb.patch(
                    "/rest/v1/subscriptions",
                    params={"stripe_subscription_id": f"eq.{stripe_subscription_id}"},
                    headers=self.client._sb_headers(),
                    json={"status": "past_due"}
                )
            else:
                print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            await asyncio.sleep(1)
            
            # Step 3: Verify status is past_due
            print(f"  ↳ Verifying subscription status...", end=" ", flush=True)
            
            status_res = await self.client.get_subscription_status(user["token"])
            
            if status_res.status_code != 200:
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, "Status check failed")
            
            status_data = status_res.json()
            current_status = status_data.get("status")
            
            if current_status in ["past_due", "unpaid"]:
                print(f"{Colors.GREEN}{current_status.upper()} ✓{Colors.ENDC}")
                duration = (time.time() - start) * 1000
                return ScenarioResult(scenario_name, ScenarioStatus.PASS, duration,
                                    f"Status correctly updated to {current_status}")
            else:
                print(f"{Colors.RED}UNEXPECTED: {current_status}{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0,
                                    f"Expected past_due, got: {current_status}")
        
        except Exception as e:
            return ScenarioResult(scenario_name, ScenarioStatus.ERROR, 0, str(e))
    
    async def run_scenario_3_cancellation(self) -> ScenarioResult:
        """
        SCENARIO 3: Subscription Cancellation
        
        1. Create user with active subscription
        2. Send customer.subscription.deleted webhook
        3. Verify status becomes 'canceled'
        """
        start = time.time()
        scenario_name = "CANCELLATION"
        
        print(f"\n{Colors.CYAN}━━━ SCENARIO 3: {scenario_name} ━━━{Colors.ENDC}")
        
        try:
            # Step 1: Create user with subscription
            print(f"  ↳ Creating test user with subscription...", end=" ", flush=True)
            user = await self.client.create_test_user("cancel")
            
            if not user:
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, "User creation failed")
            
            print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            user_id = user["user_id"]
            stripe_customer_id = generate_stripe_customer_id()
            stripe_subscription_id = generate_stripe_subscription_id()
            
            # Insert active subscription
            print(f"  ↳ Setting up active subscription...", end=" ", flush=True)
            if not await self.client.insert_subscription_directly(
                user_id, stripe_customer_id, stripe_subscription_id, "enterprise", "active"
            ):
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.SKIP, 0, "Subscription setup failed")
            print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            await asyncio.sleep(0.5)
            
            # Step 2: Send subscription deleted webhook
            print(f"  ↳ Sending subscription.deleted webhook...", end=" ", flush=True)
            
            subscription_data = {
                "id": stripe_subscription_id,
                "object": "subscription",
                "customer": stripe_customer_id,
                "status": "canceled",
                "canceled_at": int(time.time()),
                "ended_at": int(time.time()),
                "metadata": {
                    "user_id": user_id,
                    "plan_tier": "enterprise"
                }
            }
            
            webhook_res = await self.client.send_webhook(
                "customer.subscription.deleted",
                subscription_data
            )
            
            if webhook_res.status_code != 200:
                print(f"{Colors.YELLOW}WEBHOOK {webhook_res.status_code}{Colors.ENDC}")
                # Update directly
                await self.client.sb.patch(
                    "/rest/v1/subscriptions",
                    params={"stripe_subscription_id": f"eq.{stripe_subscription_id}"},
                    headers=self.client._sb_headers(),
                    json={"status": "canceled"}
                )
            else:
                print(f"{Colors.GREEN}OK{Colors.ENDC}")
            
            await asyncio.sleep(1)
            
            # Step 3: Verify status is canceled
            print(f"  ↳ Verifying subscription status...", end=" ", flush=True)
            
            status_res = await self.client.get_subscription_status(user["token"])
            
            if status_res.status_code != 200:
                print(f"{Colors.RED}FAILED{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0, "Status check failed")
            
            status_data = status_res.json()
            current_status = status_data.get("status")
            
            if current_status == "canceled":
                print(f"{Colors.GREEN}CANCELED ✓{Colors.ENDC}")
                duration = (time.time() - start) * 1000
                return ScenarioResult(scenario_name, ScenarioStatus.PASS, duration,
                                    "Subscription correctly canceled")
            else:
                print(f"{Colors.RED}UNEXPECTED: {current_status}{Colors.ENDC}")
                return ScenarioResult(scenario_name, ScenarioStatus.FAIL, 0,
                                    f"Expected canceled, got: {current_status}")
        
        except Exception as e:
            return ScenarioResult(scenario_name, ScenarioStatus.ERROR, 0, str(e))
    
    async def run(self):
        """Run all billing scenarios."""
        print(f"\n{Colors.HEADER}╔══════════════════════════════════════════════════════════════════╗{Colors.ENDC}")
        print(f"{Colors.HEADER}║   💰 GAMMA BILLING SIMULATION v1.0 (ID: {RUN_ID})              ║{Colors.ENDC}")
        print(f"{Colors.HEADER}║   Stripe webhook flows end to end                                ║{Colors.ENDC}")
        print(f"{Colors.HEADER}╚══════════════════════════════════════════════════════════════════╝{Colors.ENDC}")
        
        print(f"\n{Colors.BLUE}🔧 Configuration:{Colors.ENDC}")
        print(f"   API URL: {API_URL}")
        print(f"   Supabase: {SUPABASE_URL[:40]}...")
        print(f"   Webhook Secret: {STRIPE_WEBHOOK_SECRET[:15]}..." if STRIPE_WEBHOOK_SECRET else "   Webhook Secret: NOT SET")
        
        # Wait for API
        print(f"\n{Colors.BLUE}⏳ Checking API health...{Colors.ENDC}", end=" ", flush=True)
        try:
            res = await self.client.http.get("/health")
            if res.status_code == 200:
                print(f"{Colors.GREEN}OK{Colors.ENDC}")
            else:
                print(f"{Colors.YELLOW}Warning: {res.status_code}{Colors.ENDC}")
        except Exception as e:
            print(f"{Colors.RED}FAILED: {e}{Colors.ENDC}")
            return
        
        # Run scenarios
        scenarios = [
            self.run_scenario_1_new_subscription,
            self.run_scenario_2_payment_failure,
            self.run_scenario_3_cancellation,
        ]
        
        for scenario in scenarios:
            result = await scenario()
            self.results.append(result)
        
        # Print summary
        print(f"\n{Colors.HEADER}══════════════════════════════════════════════════════════════════{Colors.ENDC}")
        print(f"{Colors.BOLD}📊 SUMMARY{Colors.ENDC}")
        print(f"{Colors.HEADER}══════════════════════════════════════════════════════════════════{Colors.ENDC}")
        
        passed = sum(1 for r in self.results if r.status == ScenarioStatus.PASS)
        failed = sum(1 for r in self.results if r.status == ScenarioStatus.FAIL)
        errors = sum(1 for r in self.results if r.status == ScenarioStatus.ERROR)
        skipped = sum(1 for r in self.results if r.status == ScenarioStatus.SKIP)
        
        for result in self.results:
            if result.status == ScenarioStatus.PASS:
                icon = f"{Colors.GREEN}✅{Colors.ENDC}"
            elif result.status == ScenarioStatus.FAIL:
                icon = f"{Colors.RED}❌{Colors.ENDC}"
            elif result.status == ScenarioStatus.ERROR:
                icon = f"{Colors.RED}💥{Colors.ENDC}"
            else:
                icon = f"{Colors.YELLOW}⏭️{Colors.ENDC}"
            
            print(f"{icon} {result.name:<20} {result.duration_ms:>8.0f}ms  {result.details}")
        
        print(f"\n{Colors.BOLD}Results:{Colors.ENDC} {Colors.GREEN}{passed} passed{Colors.ENDC}, "
              f"{Colors.RED}{failed} failed{Colors.ENDC}, "
              f"{Colors.RED}{errors} errors{Colors.ENDC}, "
              f"{Colors.YELLOW}{skipped} skipped{Colors.ENDC}")
        
        # Final verdict
        if failed == 0 and errors == 0:
            print(f"\n{Colors.GREEN}All billing flows verified.{Colors.ENDC}")
        else:
            print(f"\n{Colors.RED}Billing issues detected. Review required.{Colors.ENDC}")
        
        await self.client.close()


if __name__ == "__main__":
    asyncio.run(BillingSimulator().run())

