"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🧪 BUDGET LOGIC UNIT TESTS                                                 ║
║   Atomic budget reservation, adjustment and credits                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests for the BudgetManager class and atomic budget operations.

All budget operations use Lua scripts for atomicity.
These tests verify the correctness of budget reservation, adjustment, and return.

Run:
    pytest packages/engine/tests/test_budget_logic.py -v

Coverage:
    pytest packages/engine/tests/test_budget_logic.py --cov=core.budget --cov-report=term-missing
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch

# Import the module under test
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.budget import BudgetManager, BudgetResult


# ============================================================================
# TEST: RESERVE BUDGET
# ============================================================================

class TestReserveBudget:
    """Tests for BudgetManager.reserve_budget()."""
    
    @pytest.mark.asyncio
    async def test_reserve_budget_success(self, budget_manager, test_project_id, test_organization_id):
        """
        Test successful budget reservation when balance allows.
        
        Scenario:
        - Budget limit: $100
        - Current spend: $0
        - Reservation: $10
        - Expected: OK, current_spend = $10
        """
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("10.00"),
            budget_limit=Decimal("100.00")
        )
        
        assert result["status"] == "OK"
        assert result["current_spend"] == Decimal("10.0")
        assert result["message"] is None
    
    @pytest.mark.asyncio
    async def test_reserve_budget_insufficient(self, budget_manager, test_project_id, test_organization_id, mock_redis):
        """
        Test budget reservation failure when limit would be exceeded.
        
        Scenario:
        - Budget limit: $100
        - Current spend: $95
        - Reservation: $10
        - Expected: BUDGET_EXCEEDED
        """
        # Pre-set current spend to $95
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "95.00")
        
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("10.00"),
            budget_limit=Decimal("100.00")
        )
        
        assert result["status"] == "BUDGET_EXCEEDED"
        assert result["current_spend"] == Decimal("95.0")
        assert "Budget limit" in result["message"]
    
    @pytest.mark.asyncio
    async def test_reserve_budget_exact_limit(self, budget_manager, test_project_id, test_organization_id, mock_redis):
        """
        Test budget reservation at exact limit boundary.
        
        Scenario:
        - Budget limit: $100
        - Current spend: $90
        - Reservation: $10 (exactly hits limit)
        - Expected: OK (spend = limit is allowed)
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "90.00")
        
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("10.00"),
            budget_limit=Decimal("100.00")
        )
        
        assert result["status"] == "OK"
        assert result["current_spend"] == Decimal("100.0")
    
    @pytest.mark.asyncio
    async def test_negative_reservation_amount(self, budget_manager, test_project_id, test_organization_id):
        """
        Test rejection of negative reservation amount.
        
        SECURITY: Negative amounts could be exploited to increase budget.
        """
        with pytest.raises(ValueError, match="INVALID_RESERVATION_AMOUNT"):
            await budget_manager.reserve_budget(
                project_id=test_project_id,
                organization_id=test_organization_id,
                amount=Decimal("-10.00"),
                budget_limit=Decimal("100.00")
            )
    
    @pytest.mark.asyncio
    async def test_zero_limit_unlimited_budget(self, budget_manager, test_project_id, test_organization_id):
        """
        Test unlimited budget (limit = 0).
        
        Business Rule: When budget_limit = 0, spending is unlimited.
        This is used for Enterprise tier or specific cases.
        """
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("1000.00"),
            budget_limit=Decimal("0.00")  # Unlimited
        )
        
        assert result["status"] == "OK_UNLIMITED"
        assert result["current_spend"] == Decimal("1000.0")
    
    @pytest.mark.asyncio
    async def test_zero_amount_free_request(self, budget_manager, test_project_id, test_organization_id):
        """
        Test free request (amount = 0).
        
        Business Rule: Cached responses and free operations have $0 cost.
        These should ALWAYS be allowed regardless of budget.
        """
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("0.00"),
            budget_limit=Decimal("100.00")
        )
        
        assert result["status"] == "OK_FREE_REQUEST"
        assert result["current_spend"] == Decimal("0.0")


# ============================================================================
# TEST: CREDITS SYSTEM (REFERRAL CREDITS)
# ============================================================================

class TestCreditsSystem:
    """Tests for referral credits and viral economics."""
    
    @pytest.mark.asyncio
    async def test_credits_fully_cover_request(self, budget_manager, test_project_id, test_organization_id, mock_redis):
        """
        Test request fully covered by referral credits.
        
        Scenario:
        - Credits: $50
        - Request: $10
        - Expected: OK_CREDITS_USED, credits = $40, budget unchanged
        """
        credits_key = f"credits:{test_organization_id}"
        await mock_redis.set(credits_key, "50.00")
        
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("10.00"),
            budget_limit=Decimal("100.00")
        )
        
        assert result["status"] == "OK_CREDITS_USED"
        assert result["current_spend"] == Decimal("0.0")  # Budget untouched
        
        # Verify credits were deducted
        remaining_credits = await budget_manager.get_credits_balance(test_organization_id)
        assert remaining_credits == Decimal("40.0")
    
    @pytest.mark.asyncio
    async def test_credits_partially_cover_request(self, budget_manager, test_project_id, test_organization_id, mock_redis):
        """
        Test request partially covered by credits.
        
        Scenario:
        - Credits: $5
        - Request: $10
        - Expected: OK_CREDITS_PARTIAL, $5 from credits, $5 from budget
        """
        credits_key = f"credits:{test_organization_id}"
        await mock_redis.set(credits_key, "5.00")
        
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("10.00"),
            budget_limit=Decimal("100.00")
        )
        
        assert result["status"] == "OK_CREDITS_PARTIAL"
        assert result["current_spend"] == Decimal("5.0")  # Only $5 charged to budget
        
        # Credits should be depleted
        remaining_credits = await budget_manager.get_credits_balance(test_organization_id)
        assert remaining_credits == Decimal("0.0")
    
    @pytest.mark.asyncio
    async def test_add_credits(self, budget_manager, test_organization_id):
        """
        Test adding referral credits.
        
        Referrers get REFERRAL_CREDIT_AMOUNT_USD in credit for each referral.
        """
        # Initial balance is 0
        initial = await budget_manager.get_credits_balance(test_organization_id)
        assert initial == Decimal("0.0")
        
        # Add referral credits
        new_balance = await budget_manager.add_credits(test_organization_id, Decimal("100.00"))
        assert new_balance == Decimal("100.0")
        
        # Verify persistence
        balance = await budget_manager.get_credits_balance(test_organization_id)
        assert balance == Decimal("100.0")


# ============================================================================
# TEST: ADJUST BUDGET
# ============================================================================

class TestAdjustBudget:
    """Tests for BudgetManager.adjust_budget()."""
    
    @pytest.mark.asyncio
    async def test_adjust_budget_positive(self, budget_manager, test_project_id, mock_redis):
        """
        Test positive budget adjustment (additional charge).
        
        Scenario: API call was underestimated, add $5 more.
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "10.00")
        
        result = await budget_manager.adjust_budget(
            project_id=test_project_id,
            adjustment=Decimal("5.00")
        )
        
        assert result["status"] == "OK"
        assert result["current_spend"] == Decimal("15.0")
    
    @pytest.mark.asyncio
    async def test_adjust_budget_negative(self, budget_manager, test_project_id, mock_redis):
        """
        Test negative budget adjustment (refund/correction).
        
        Scenario: API call was overestimated, refund $3.
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "10.00")
        
        result = await budget_manager.adjust_budget(
            project_id=test_project_id,
            adjustment=Decimal("-3.00")
        )
        
        assert result["status"] == "OK"
        assert result["current_spend"] == Decimal("7.0")
    
    @pytest.mark.asyncio
    async def test_adjust_budget_floor_protection(self, budget_manager, test_project_id, mock_redis):
        """
        Test floor protection when adjustment would go negative.
        
        SECURITY: Prevents spend from going negative (which would allow unlimited spending).
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "5.00")
        
        result = await budget_manager.adjust_budget(
            project_id=test_project_id,
            adjustment=Decimal("-10.00")  # Would result in -$5
        )
        
        assert result["status"] == "FLOOR_HIT"
        assert result["current_spend"] == Decimal("0.0")  # Floor at 0


# ============================================================================
# TEST: RETURN BUDGET
# ============================================================================

class TestReturnBudget:
    """Tests for BudgetManager.return_budget()."""
    
    @pytest.mark.asyncio
    async def test_return_budget_success(self, budget_manager, test_project_id, mock_redis):
        """
        Test successful budget return (e.g., cached response).
        
        Scenario: Request was cached, return reserved $10.
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "50.00")
        
        result = await budget_manager.return_budget(
            project_id=test_project_id,
            amount=Decimal("10.00")
        )
        
        assert result["status"] == "OK"
        assert result["current_spend"] == Decimal("40.0")
    
    @pytest.mark.asyncio
    async def test_return_budget_negative_amount_rejected(self, budget_manager, test_project_id):
        """
        Test rejection of negative return amount.
        
        SECURITY: Negative return would effectively add to spend.
        """
        result = await budget_manager.return_budget(
            project_id=test_project_id,
            amount=Decimal("-10.00")
        )
        
        assert result["status"] == "INVALID_RETURN_AMOUNT"
    
    @pytest.mark.asyncio
    async def test_return_budget_floor_protection(self, budget_manager, test_project_id, mock_redis):
        """
        Test floor protection when return exceeds current spend.
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "5.00")
        
        result = await budget_manager.return_budget(
            project_id=test_project_id,
            amount=Decimal("10.00")  # More than current spend
        )
        
        assert result["status"] == "FLOOR_HIT"
        assert result["current_spend"] == Decimal("0.0")


# ============================================================================
# TEST: GET CURRENT SPEND
# ============================================================================

class TestGetCurrentSpend:
    """Tests for BudgetManager.get_current_spend()."""
    
    @pytest.mark.asyncio
    async def test_get_spend_existing(self, budget_manager, test_project_id, mock_redis):
        """Test getting existing spend value."""
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "42.50")
        
        spend = await budget_manager.get_current_spend(test_project_id)
        assert spend == Decimal("42.50")
    
    @pytest.mark.asyncio
    async def test_get_spend_nonexistent(self, budget_manager, test_project_id):
        """Test getting spend for new project (defaults to 0)."""
        spend = await budget_manager.get_current_spend(test_project_id)
        assert spend == Decimal("0.00")


# ============================================================================
# TEST: EDGE CASES & PRECISION
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and financial precision."""
    
    @pytest.mark.asyncio
    async def test_decimal_precision(self, budget_manager, test_project_id, test_organization_id, mock_redis):
        """
        Test that Decimal precision is maintained.
        
        Money is Decimal (or integer cents), never float.
        """
        budget_key = f"project_spend:{test_project_id}"
        await mock_redis.set(budget_key, "0.00")
        
        # Reserve with high precision
        result = await budget_manager.reserve_budget(
            project_id=test_project_id,
            organization_id=test_organization_id,
            amount=Decimal("0.001"),  # Sub-cent precision
            budget_limit=Decimal("1.00")
        )
        
        assert result["status"] == "OK"
        # Precision should be maintained
        spend = await budget_manager.get_current_spend(test_project_id)
        assert spend == Decimal("0.001")
    
    @pytest.mark.asyncio
    async def test_concurrent_reservations(self, budget_manager, test_project_id, test_organization_id, mock_redis):
        """
        Test behavior with multiple sequential reservations.
        
        Note: True concurrency testing requires integration tests with real Redis.
        This tests sequential correctness.
        """
        import asyncio
        
        # Make 5 reservations of $10 each
        results = []
        for _ in range(5):
            result = await budget_manager.reserve_budget(
                project_id=test_project_id,
                organization_id=test_organization_id,
                amount=Decimal("10.00"),
                budget_limit=Decimal("100.00")
            )
            results.append(result)
        
        # All should succeed
        for r in results:
            assert r["status"] == "OK"
        
        # Final spend should be $50
        final_spend = await budget_manager.get_current_spend(test_project_id)
        assert final_spend == Decimal("50.0")
    
    @pytest.mark.asyncio
    async def test_key_generation(self, budget_manager, test_project_id, test_organization_id):
        """Test that Redis keys are generated correctly."""
        budget_key = budget_manager._get_budget_key(test_project_id)
        credits_key = budget_manager._get_credits_key(test_organization_id)
        
        assert budget_key == f"project_spend:{test_project_id}"
        assert credits_key == f"credits:{test_organization_id}"

