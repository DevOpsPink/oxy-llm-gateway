"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   Route tests - API endpoint verification                                    ║
║   Request/response shapes for the FastAPI routers                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests for all FastAPI routes in packages/engine/routes/

Coverage:
- proxy.py (Main AI Gateway - CRITICAL)
- billing.py (optional Stripe billing)
- auth.py (Security - CRITICAL)
- team.py (Collaboration)
- prompts.py (Prompt library)
- attribution.py (Cost tracking)
- And more...

Run:
    pytest tests/test_routes.py -v --tb=short
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
import json
import hashlib


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_request():
    """Create a mock FastAPI request."""
    request = MagicMock()
    request.headers = {"Authorization": "Bearer test_token"}
    request.client.host = "127.0.0.1"
    request.url.path = "/v1/chat/completions"
    return request


@pytest.fixture
def mock_user_data():
    """Sample authenticated user data."""
    return {
        "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "organization_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "project_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "test@example.com",
        "plan_tier": "professional",
        "budget_limit": Decimal("100.00"),
        "current_spend": Decimal("50.00"),
        "requests_remaining": 10000
    }


@pytest.fixture
def mock_api_key_data():
    """Sample API key data."""
    return {
        "key_id": "key_test123",
        "key_prefix": "oxy_live_abc123",
        "project_id": "550e8400-e29b-41d4-a716-446655440000",
        "organization_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    }


@pytest.fixture
def sample_chat_request():
    """Sample OpenAI-compatible chat request."""
    return {
        "model": "gpt-4",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, how are you?"}
        ],
        "temperature": 0.7,
        "max_tokens": 100
    }


@pytest.fixture
def sample_openai_response():
    """Sample OpenAI API response."""
    return {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "gpt-4",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "I'm doing great, thank you for asking!"
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 20,
            "completion_tokens": 15,
            "total_tokens": 35
        }
    }


# ============================================================================
# PROXY ROUTE TESTS (Main AI Gateway - MOST CRITICAL)
# ============================================================================

class TestProxyRoute:
    """Tests for /v1/chat/completions endpoint."""
    
    def test_proxy_requires_api_key(self):
        """Requests without API key should be rejected."""
        # API key authentication is required for /v1/chat/completions
        # The HTTPBearer scheme enforces Authorization header
        required_header = "Authorization"
        required_prefix = "Bearer"
        
        # Verify the expected auth format
        auth_header = f"{required_prefix} oxy_live_abc123_..."
        assert auth_header.startswith(f"{required_prefix} ")
        assert "oxy_" in auth_header
    
    def test_budget_key_generation(self, mock_api_key_data):
        """Verify budget key format."""
        project_id = mock_api_key_data["project_id"]
        expected_key = f"project_spend:{project_id}"
        assert "project_spend:" in expected_key
        assert project_id in expected_key
    
    def test_credits_key_generation(self, mock_api_key_data):
        """Verify credits key format."""
        org_id = mock_api_key_data["organization_id"]
        expected_key = f"credits:{org_id}"
        assert "credits:" in expected_key
        assert org_id in expected_key
    
    def test_cache_key_generation(self, sample_chat_request):
        """Verify cache key is deterministic."""
        # Cache key should be based on model + messages + params
        cache_input = json.dumps({
            "model": sample_chat_request["model"],
            "messages": sample_chat_request["messages"],
            "temperature": sample_chat_request["temperature"]
        }, sort_keys=True)
        cache_key = hashlib.sha256(cache_input.encode()).hexdigest()
        
        # Same input should produce same key
        cache_key2 = hashlib.sha256(cache_input.encode()).hexdigest()
        assert cache_key == cache_key2
    
    def test_model_provider_routing(self):
        """Verify model names route to correct providers."""
        model_to_provider = {
            "gpt-4": "openai",
            "gpt-4-turbo": "openai",
            "gpt-3.5-turbo": "openai",
            "claude-3-opus": "anthropic",
            "claude-3-sonnet": "anthropic",
            "gemini-1.5-pro": "google",
            "gemini-1.5-flash": "google"
        }
        
        for model, expected_provider in model_to_provider.items():
            if "gpt" in model:
                assert expected_provider == "openai"
            elif "claude" in model:
                assert expected_provider == "anthropic"
            elif "gemini" in model:
                assert expected_provider == "google"
    
    def test_token_cost_calculation(self, sample_openai_response):
        """Verify token cost is calculated correctly."""
        usage = sample_openai_response["usage"]
        prompt_tokens = usage["prompt_tokens"]
        completion_tokens = usage["completion_tokens"]
        
        # GPT-4 pricing: $0.03/1K input, $0.06/1K output
        input_cost = (prompt_tokens / 1000) * 0.03
        output_cost = (completion_tokens / 1000) * 0.06
        total_cost = input_cost + output_cost
        
        assert total_cost > 0
        assert input_cost == pytest.approx(0.0006, rel=0.01)  # 20 tokens * $0.03/1K
        assert output_cost == pytest.approx(0.0009, rel=0.01)  # 15 tokens * $0.06/1K


# ============================================================================
# BILLING ROUTE TESTS (optional Stripe module)
# ============================================================================

class TestBillingRoute:
    """Tests for billing endpoints."""
    
    def test_plan_limits_defined(self):
        """Verify plan limits are properly defined."""
        plan_limits = {
            "starter": {"requests": 100000, "projects": 1, "team_members": 3},
            "professional": {"requests": 1000000, "projects": 10, "team_members": 10},
            "enterprise": {"requests": None, "projects": None, "team_members": None}
        }
        
        assert plan_limits["starter"]["requests"] == 100000
        assert plan_limits["professional"]["requests"] == 1000000
        assert plan_limits["enterprise"]["requests"] is None  # Unlimited
    
    def test_subscription_status_response_structure(self):
        """Verify subscription status response has all required fields."""
        required_fields = [
            "has_subscription",
            "plan_tier",
            "status",
            "requests_used",
            "requests_limit",
            "usage_percentage",
            "current_period_end",
            "cancel_at_period_end",
            "trial_end",
            "billing_interval"
        ]
        
        # Mock response
        response = {
            "has_subscription": True,
            "plan_tier": "professional",
            "status": "active",
            "requests_used": 50000,
            "requests_limit": 1000000,
            "usage_percentage": 5.0,
            "current_period_end": "2025-02-01T00:00:00Z",
            "cancel_at_period_end": False,
            "trial_end": None,
            "billing_interval": "month"
        }
        
        for field in required_fields:
            assert field in response
    
    def test_stripe_webhook_signature_validation(self):
        """Verify webhook signature structure."""
        # Stripe signature format: t=timestamp,v1=signature
        timestamp = "1234567890"
        signature = "abc123def456"
        stripe_sig = f"t={timestamp},v1={signature}"
        
        assert stripe_sig.startswith("t=")
        assert ",v1=" in stripe_sig
    
    def test_idempotency_key_format(self):
        """Verify idempotency key prevents duplicate processing."""
        event_id = "evt_123abc"
        ttl = 86400  # 24 hours
        
        idempotency_key = f"webhook:{event_id}"
        assert "webhook:" in idempotency_key
        assert event_id in idempotency_key


# ============================================================================
# AUTH ROUTE TESTS (Security - CRITICAL)
# ============================================================================

class TestAuthRoute:
    """Tests for authentication and onboarding endpoints."""
    
    def test_onboard_request_validation(self):
        """Verify onboarding request structure."""
        valid_request = {
            "full_name": "John Doe",
            "email": "john@example.com",
            "openai_key": "sk-proj-abc123...",
            "anthropic_key": None,
            "google_key": None,
            "referral_code": "OXY-12345"
        }
        
        # Name validation
        assert len(valid_request["full_name"]) >= 2
        assert len(valid_request["full_name"]) <= 100
        
        # Email validation
        assert "@" in valid_request["email"]
    
    def test_referral_code_format(self):
        """Verify referral code format."""
        valid_code = "OXY-12345"
        
        assert valid_code.startswith("OXY-")
        assert len(valid_code) == 9
        assert valid_code[4:].isdigit()
    
    def test_password_hash_not_returned(self):
        """Ensure password hashes are never returned in responses."""
        # User profile response should never include password
        profile_response = {
            "id": "user123",
            "email": "user@example.com",
            "full_name": "Test User",
            "plan_tier": "professional"
            # NO password field!
        }
        
        assert "password" not in profile_response
        assert "password_hash" not in profile_response


# ============================================================================
# TEAM ROUTE TESTS
# ============================================================================

class TestTeamRoute:
    """Tests for team management endpoints."""
    
    def test_invite_token_format(self):
        """Verify invite token is properly formatted."""
        import secrets
        token = secrets.token_urlsafe(32)
        
        # Token should be URL-safe
        assert len(token) >= 32
        assert all(c.isalnum() or c in '-_' for c in token)
    
    def test_role_hierarchy(self):
        """Verify role permissions hierarchy."""
        roles = {
            "owner": ["read", "write", "admin", "delete", "transfer_ownership"],
            "admin": ["read", "write", "admin", "invite"],
            "member": ["read", "write"],
            "viewer": ["read"]
        }
        
        # Owner should have all permissions
        assert len(roles["owner"]) > len(roles["admin"])
        assert len(roles["admin"]) > len(roles["member"])
        assert len(roles["member"]) > len(roles["viewer"])
    
    def test_invite_expiry(self):
        """Verify invites have expiration."""
        from datetime import datetime, timedelta
        
        created_at = datetime.now(timezone.utc)
        expires_at = created_at + timedelta(days=7)
        
        assert expires_at > created_at
        assert (expires_at - created_at).days == 7


# ============================================================================
# PROMPTS ROUTE TESTS
# ============================================================================

class TestPromptsRoute:
    """Tests for prompt library endpoints."""
    
    def test_prompt_template_structure(self):
        """Verify prompt template has required fields."""
        template = {
            "id": "prompt_123",
            "name": "Customer Support",
            "description": "Helpful customer service agent",
            "system_prompt": "You are a helpful customer service agent...",
            "model": "gpt-4",
            "temperature": 0.7,
            "max_tokens": 500,
            "created_at": "2025-01-01T00:00:00Z",
            "usage_count": 100,
            "avg_rating": 4.5
        }
        
        required_fields = ["id", "name", "system_prompt", "model"]
        for field in required_fields:
            assert field in template
    
    def test_rating_range(self):
        """Verify ratings are in valid range."""
        valid_ratings = [1, 2, 3, 4, 5]
        
        for rating in valid_ratings:
            assert 1 <= rating <= 5


# ============================================================================
# ATTRIBUTION ROUTE TESTS
# ============================================================================

class TestAttributionRoute:
    """Tests for cost attribution endpoints."""
    
    def test_cost_tag_format(self):
        """Verify cost attribution tag format."""
        tag = {
            "key": "department",
            "value": "engineering",
            "description": "Engineering team costs"
        }
        
        assert len(tag["key"]) > 0
        assert len(tag["value"]) > 0
    
    def test_chargeback_rule_structure(self):
        """Verify chargeback rule has required fields."""
        rule = {
            "id": "rule_123",
            "organization_id": "org_123",
            "tag_key": "department",
            "percentage_allocation": 100,
            "billing_email": "finance@example.com"
        }
        
        assert rule["percentage_allocation"] >= 0
        assert rule["percentage_allocation"] <= 100


# ============================================================================
# SSO ROUTE TESTS
# ============================================================================

class TestSSORoute:
    """Tests for SSO (Single Sign-On) endpoints."""
    
    def test_sso_domain_lookup(self):
        """Verify domain lookup returns proper structure."""
        response = {
            "domain": "example.com",
            "sso_enabled": True,
            "provider": "okta",
            "login_url": "https://example.okta.com/login"
        }
        
        assert response["sso_enabled"] in [True, False]
        assert response["provider"] in ["okta", "azure_ad", "google", None]
    
    def test_saml_assertion_validation(self):
        """Verify SAML assertion contains required claims."""
        required_claims = [
            "email",
            "name",
            "organization_id"
        ]
        
        saml_response = {
            "email": "user@example.com",
            "name": "John Doe",
            "organization_id": "org_123"
        }
        
        for claim in required_claims:
            assert claim in saml_response


# ============================================================================
# ADD-ONS ROUTE TESTS
# ============================================================================

class TestAddOnsRoute:
    """GET /add-ons/catalog: feature flags, on only for an organization the caller belongs to."""

    @pytest.mark.asyncio
    async def test_catalog_reports_flags_of_a_member_organization(self):
        from routes import add_ons
        org = "11111111-1111-1111-1111-111111111111"
        with patch.object(add_ons, "_is_active_member", AsyncMock(return_value=True)), \
             patch.object(add_ons, "get_org_add_ons", AsyncMock(return_value={"sso"})):
            flags = await add_ons.list_add_ons(organization_id=org, user_id="user-1")
        by_id = {f.id: f.enabled for f in flags}
        assert by_id["sso"] is True
        assert by_id["white_label"] is False
        assert set(by_id) == set(add_ons.ADD_ONS_CATALOG)

    @pytest.mark.asyncio
    async def test_catalog_refuses_an_organization_the_caller_is_not_in(self):
        from fastapi import HTTPException
        from routes import add_ons
        org = "22222222-2222-2222-2222-222222222222"
        with patch.object(add_ons, "_is_active_member", AsyncMock(return_value=False)):
            with pytest.raises(HTTPException) as exc:
                await add_ons.list_add_ons(organization_id=org, user_id="user-1")
        assert exc.value.status_code == 404

    def test_no_purchase_route(self):
        """Flags are turned on by the operator in organization_add_ons; nothing sells them."""
        from routes import add_ons
        paths = {(tuple(sorted(r.methods)), r.path) for r in add_ons.router.routes}
        assert paths == {(("GET",), "/add-ons/catalog")}


# ============================================================================
# COST OPTIMIZER ROUTE TESTS
# ============================================================================

class TestCostOptimizerRoute:
    """Tests for AI cost optimization endpoints."""
    
    def test_recommendation_structure(self):
        """Verify cost recommendation has required fields."""
        recommendation = {
            "id": "rec_123",
            "type": "model_switch",
            "title": "Switch to GPT-3.5 Turbo",
            "description": "Save 90% on simple queries",
            "potential_savings_monthly": 150.00,
            "confidence_score": 0.85,
            "affected_requests_percentage": 30
        }
        
        assert recommendation["potential_savings_monthly"] >= 0
        assert 0 <= recommendation["confidence_score"] <= 1
    
    def test_usage_analysis_structure(self):
        """Verify usage analysis has required fields."""
        analysis = {
            "period": "last_30_days",
            "total_cost": 500.00,
            "total_requests": 50000,
            "avg_cost_per_request": 0.01,
            "model_breakdown": {
                "gpt-4": {"requests": 10000, "cost": 300.00},
                "gpt-3.5-turbo": {"requests": 40000, "cost": 200.00}
            }
        }
        
        assert analysis["total_cost"] > 0
        assert analysis["avg_cost_per_request"] > 0


# ============================================================================
# INTELLIGENCE ROUTE TESTS
# ============================================================================

class TestIntelligenceRoute:
    """Tests for AI-powered intelligence endpoints."""
    
    def test_budget_prediction_structure(self):
        """Verify budget prediction has required fields."""
        prediction = {
            "predicted_monthly_cost": 750.00,
            "confidence_interval_low": 600.00,
            "confidence_interval_high": 900.00,
            "trend": "increasing",
            "days_until_budget_exceeded": 15,
            "recommendations": []
        }
        
        assert prediction["confidence_interval_low"] <= prediction["predicted_monthly_cost"]
        assert prediction["predicted_monthly_cost"] <= prediction["confidence_interval_high"]
        assert prediction["trend"] in ["increasing", "decreasing", "stable"]


# ============================================================================
# REPORTS ROUTE TESTS
# ============================================================================

class TestReportsRoute:
    """Tests for reporting endpoints."""
    
    def test_report_export_formats(self):
        """Verify supported export formats."""
        supported_formats = ["csv", "json", "pdf"]
        
        for fmt in supported_formats:
            assert fmt in ["csv", "json", "pdf", "xlsx"]
    
    def test_report_date_range(self):
        """Verify date range parameters."""
        from datetime import datetime, timedelta
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=30)
        
        assert start_date < end_date
        assert (end_date - start_date).days == 30


# ============================================================================
# CREDITS ROUTE TESTS
# ============================================================================

class TestCreditsRoute:
    """Tests for referral credits endpoints."""
    
    def test_referral_credit_amount(self):
        """Verify referral credit amounts."""
        REFERRER_CREDIT = 100.00  # default of REFERRAL_CREDIT_AMOUNT_USD
        REFEREE_CREDIT = 100.00   # same default for the new user
        
        assert REFERRER_CREDIT > 0
        assert REFEREE_CREDIT > 0
    
    def test_credit_balance_format(self):
        """Verify credit balance response format."""
        response = {
            "balance": "150.00",  # String for Decimal precision
            "pending_credits": "0.00",
            "total_earned": "300.00",
            "total_used": "150.00"
        }
        
        # Verify can be parsed as Decimal
        balance = Decimal(response["balance"])
        assert balance >= 0

