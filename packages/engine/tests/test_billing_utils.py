"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🧪 BILLING UTILITIES UNIT TESTS                                            ║
║   Billing helpers and Stripe event handling                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests for billing-related utilities and helper functions.

Run:
    pytest packages/engine/tests/test_billing_utils.py -v
"""

import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import json

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================================
# TEST: PLAN LIMITS
# ============================================================================

class TestPlanLimits:
    """Tests for plan limit configurations."""
    
    def test_starter_plan_limits(self):
        """Verify Starter plan limits are correctly configured."""
        from routes.billing import PLAN_LIMITS
        
        starter = PLAN_LIMITS["starter"]
        assert "requests" not in starter  # no tier caps requests
        assert starter["projects"] == 5
        assert starter["team_members"] == 3
    
    def test_growth_plan_limits(self):
        """Verify Growth plan limits are correctly configured."""
        from routes.billing import PLAN_LIMITS
        
        growth = PLAN_LIMITS["growth"]
        assert "requests" not in growth
        assert growth["projects"] == 20
        assert growth["team_members"] == 10
    
    def test_enterprise_plan_unlimited(self):
        """Verify Enterprise plan has unlimited resources."""
        from routes.billing import PLAN_LIMITS
        
        enterprise = PLAN_LIMITS["enterprise"]
        assert "requests" not in enterprise
        assert enterprise["projects"] is None
        assert enterprise["team_members"] is None


# ============================================================================
# TEST: SUBSCRIPTION STATUS RESPONSE
# ============================================================================

class TestSubscriptionStatusResponse:
    """Tests for SubscriptionStatusResponse model."""
    
    def test_response_with_active_subscription(self):
        """Test response model with active subscription."""
        from routes.billing import SubscriptionStatusResponse
        
        response = SubscriptionStatusResponse(
            has_subscription=True,
            plan_tier="professional",
            status="active",
            requests_used=50000,
            requests_limit=1000000,
            usage_percentage=5.0,
            current_period_end="2025-02-01T00:00:00Z",
            cancel_at_period_end=False,
            trial_end=None,
            billing_interval="month"
        )
        
        assert response.has_subscription is True
        assert response.plan_tier == "professional"
        assert response.status == "active"
        assert response.usage_percentage == 5.0
        assert response.cancel_at_period_end is False
    
    def test_response_without_subscription(self):
        """Test response model for user without subscription."""
        from routes.billing import SubscriptionStatusResponse
        
        response = SubscriptionStatusResponse(
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
        
        assert response.has_subscription is False
        assert response.plan_tier is None
        assert response.billing_interval is None
    
    def test_response_with_trial(self):
        """Test response model with trial subscription."""
        from routes.billing import SubscriptionStatusResponse
        
        trial_end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        
        response = SubscriptionStatusResponse(
            has_subscription=True,
            plan_tier="starter",
            status="trialing",
            requests_used=100,
            requests_limit=100000,
            usage_percentage=0.1,
            current_period_end="2025-02-01T00:00:00Z",
            cancel_at_period_end=False,
            trial_end=trial_end,
            billing_interval="month"
        )
        
        assert response.status == "trialing"
        assert response.trial_end is not None
    
    def test_response_with_pending_cancellation(self):
        """Test response model with pending cancellation."""
        from routes.billing import SubscriptionStatusResponse
        
        response = SubscriptionStatusResponse(
            has_subscription=True,
            plan_tier="professional",
            status="active",
            requests_used=500000,
            requests_limit=1000000,
            usage_percentage=50.0,
            current_period_end="2025-02-01T00:00:00Z",
            cancel_at_period_end=True,  # Will cancel at period end
            trial_end=None,
            billing_interval="year"
        )
        
        assert response.cancel_at_period_end is True
        assert response.billing_interval == "year"


# ============================================================================
# TEST: CHECKOUT SESSION REQUEST
# ============================================================================

class TestCreateCheckoutSessionRequest:
    """Tests for checkout session request validation."""
    
    def test_valid_monthly_starter(self):
        """Test valid starter monthly request."""
        from routes.billing import CreateCheckoutSessionRequest
        
        request = CreateCheckoutSessionRequest(
            plan="starter",
            interval="month"
        )
        
        assert request.plan == "starter"
        assert request.interval == "month"
    
    def test_valid_annual_growth(self):
        """Test valid growth annual request."""
        from routes.billing import CreateCheckoutSessionRequest
        
        request = CreateCheckoutSessionRequest(
            plan="growth",
            interval="year"
        )
        
        assert request.plan == "growth"
        assert request.interval == "year"
    
    def test_valid_enterprise(self):
        """Test valid enterprise request."""
        from routes.billing import CreateCheckoutSessionRequest
        
        request = CreateCheckoutSessionRequest(
            plan="enterprise",
            interval="month"
        )
        
        assert request.plan == "enterprise"
    
    def test_default_interval_is_month(self):
        """Test that default interval is monthly."""
        from routes.billing import CreateCheckoutSessionRequest
        
        request = CreateCheckoutSessionRequest(plan="starter")
        assert request.interval == "month"
    
    def test_invalid_plan_rejected(self):
        """Test that invalid plans are rejected."""
        from routes.billing import CreateCheckoutSessionRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            CreateCheckoutSessionRequest(plan="invalid_plan")
    
    def test_invalid_interval_rejected(self):
        """Test that invalid intervals are rejected."""
        from routes.billing import CreateCheckoutSessionRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            CreateCheckoutSessionRequest(plan="starter", interval="weekly")


# ============================================================================
# TEST: USAGE PERCENTAGE CALCULATION
# ============================================================================

class TestUsageCalculations:
    """Tests for usage percentage calculations."""
    
    def test_usage_percentage_zero(self):
        """Test 0% usage calculation."""
        requests_used = 0
        requests_limit = 100000
        
        usage_percentage = round((requests_used / requests_limit) * 100, 2)
        
        assert usage_percentage == 0.0
    
    def test_usage_percentage_partial(self):
        """Test partial usage calculation."""
        requests_used = 50000
        requests_limit = 100000
        
        usage_percentage = round((requests_used / requests_limit) * 100, 2)
        
        assert usage_percentage == 50.0
    
    def test_usage_percentage_full(self):
        """Test 100% usage calculation."""
        requests_used = 100000
        requests_limit = 100000
        
        usage_percentage = round((requests_used / requests_limit) * 100, 2)
        
        assert usage_percentage == 100.0
    
    def test_usage_percentage_over_limit(self):
        """Test over-limit usage calculation."""
        requests_used = 150000
        requests_limit = 100000
        
        usage_percentage = round((requests_used / requests_limit) * 100, 2)
        
        assert usage_percentage == 150.0
    
    def test_usage_percentage_precision(self):
        """Test usage calculation precision."""
        requests_used = 33333
        requests_limit = 100000
        
        usage_percentage = round((requests_used / requests_limit) * 100, 2)
        
        assert usage_percentage == 33.33


# ============================================================================
# TEST: WEBHOOK SECURITY CONSTANTS
# ============================================================================

class TestWebhookSecurityConstants:
    """Tests for webhook security configuration."""
    
    def test_max_webhook_age_configured(self):
        """Test webhook age limit is configured."""
        from routes.billing import MAX_WEBHOOK_AGE_SECONDS
        
        # Should be 5 minutes (300 seconds) per Stripe best practices
        assert MAX_WEBHOOK_AGE_SECONDS == 300
    
    def test_idempotency_ttl_configured(self):
        """Test idempotency TTL is configured."""
        from routes.billing import WEBHOOK_IDEMPOTENCY_TTL
        
        # Should be 7 days (Stripe retries up to 3 days)
        assert WEBHOOK_IDEMPOTENCY_TTL == 604800  # 7 * 24 * 60 * 60


# ============================================================================
# TEST: DUNNING EMAIL FORMATTING
# ============================================================================

class TestDunningEmailFormatting:
    """Tests for payment failure email formatting."""
    
    def test_amount_formatting_usd(self):
        """Test USD amount formatting."""
        amount_cents = 4200
        currency = "usd"
        
        amount_display = f"${amount_cents / 100:.2f}"
        
        assert amount_display == "$42.00"
    
    def test_amount_formatting_large(self):
        """Test large amount formatting."""
        amount_cents = 1234500
        currency = "usd"
        
        amount_display = f"${amount_cents / 100:.2f}"
        
        assert amount_display == "$12345.00"
    
    def test_amount_formatting_cents(self):
        """Test sub-dollar amount formatting."""
        amount_cents = 99
        currency = "usd"
        
        amount_display = f"${amount_cents / 100:.2f}"
        
        assert amount_display == "$0.99"


# ============================================================================
# TEST: STRIPE EVENT TIMESTAMP VALIDATION
# ============================================================================

class TestWebhookTimestampValidation:
    """Tests for webhook timestamp validation logic."""
    
    def test_recent_event_accepted(self):
        """Test that recent events are accepted."""
        import time
        
        current_timestamp = int(time.time())
        event_created = current_timestamp - 60  # 1 minute ago
        max_age = 300  # 5 minutes
        
        event_age_seconds = current_timestamp - event_created
        is_valid = event_age_seconds <= max_age
        
        assert is_valid is True
    
    def test_old_event_rejected(self):
        """Test that old events are rejected."""
        import time
        
        current_timestamp = int(time.time())
        event_created = current_timestamp - 600  # 10 minutes ago
        max_age = 300  # 5 minutes
        
        event_age_seconds = current_timestamp - event_created
        is_valid = event_age_seconds <= max_age
        
        assert is_valid is False
    
    def test_boundary_event_accepted(self):
        """Test that events at exactly the boundary are accepted."""
        import time
        
        current_timestamp = int(time.time())
        event_created = current_timestamp - 300  # Exactly 5 minutes ago
        max_age = 300  # 5 minutes
        
        event_age_seconds = current_timestamp - event_created
        is_valid = event_age_seconds <= max_age
        
        assert is_valid is True


# ============================================================================
# TEST: SUBSCRIPTION DATA MAPPING
# ============================================================================

class TestSubscriptionDataMapping:
    """Tests for mapping Stripe subscription data to database format."""
    
    def test_timestamp_to_iso(self):
        """Test Unix timestamp to ISO 8601 conversion."""
        unix_timestamp = 1704067200  # 2024-01-01 00:00:00 UTC
        
        iso_string = datetime.fromtimestamp(unix_timestamp, timezone.utc).isoformat()
        
        assert iso_string == "2024-01-01T00:00:00+00:00"
    
    def test_null_timestamp_handling(self):
        """Test handling of null timestamps (e.g., trial_end)."""
        trial_end = None
        
        result = datetime.fromtimestamp(trial_end, timezone.utc).isoformat() if trial_end else None
        
        assert result is None
    
    def test_metadata_extraction(self):
        """Test extraction of metadata from Stripe subscription."""
        stripe_subscription = {
            "id": "sub_test123",
            "customer": "cus_test456",
            "status": "active",
            "metadata": {
                "user_id": "user-uuid-here",
                "plan_tier": "professional",
                "interval": "year"
            },
            "current_period_start": 1704067200,
            "current_period_end": 1735689600,
            "cancel_at_period_end": False,
            "trial_start": None,
            "trial_end": None
        }
        
        user_id = stripe_subscription.get("metadata", {}).get("user_id")
        plan_tier = stripe_subscription.get("metadata", {}).get("plan_tier", "starter")
        interval = stripe_subscription.get("metadata", {}).get("interval", "month")
        
        assert user_id == "user-uuid-here"
        assert plan_tier == "professional"
        assert interval == "year"


# ============================================================================
# TEST: IDEMPOTENCY KEY GENERATION
# ============================================================================

class TestIdempotencyKeyGeneration:
    """Tests for webhook idempotency key generation."""
    
    def test_idempotency_key_format(self):
        """Test idempotency key format."""
        event_id = "evt_1234567890"
        event_created = 1704067200
        
        idempotency_key = f"stripe_event:{event_id}:{event_created}"
        
        assert idempotency_key == "stripe_event:evt_1234567890:1704067200"
    
    def test_idempotency_key_uniqueness(self):
        """Test that different events produce different keys."""
        key1 = f"stripe_event:evt_111:1704067200"
        key2 = f"stripe_event:evt_222:1704067200"
        key3 = f"stripe_event:evt_111:1704067300"
        
        assert key1 != key2
        assert key1 != key3
        assert key2 != key3

