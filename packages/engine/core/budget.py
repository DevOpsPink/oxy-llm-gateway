import logging
from decimal import Decimal
from typing import Dict, Optional, Any, TypedDict

from redis.asyncio import Redis
from redis.exceptions import RedisError
import structlog

# Initialize structured logger
logger = structlog.get_logger("oxy.engine.budget")


# ============================================================================
# LUA SCRIPTS - ATOMIC BUDGET OPERATIONS
# ============================================================================

LUA_RESERVE_BUDGET = """
-- ============================================================================
-- LUA_RESERVE_BUDGET - ATOMIC BUDGET RESERVATION WITH CREDIT REDEMPTION
-- ============================================================================
-- PURPOSE: Reserve budget BEFORE making provider API call
-- Referral credits are used BEFORE charging the budget
--
-- BUSINESS RULES:
-- - If budget_limit = 0: Unlimited (skip check)
-- - If reservation_amount = 0: ALWAYS ALLOW (free requests, cached responses)
-- - PRIORITY 1: Deduct from credits (if available)
-- - PRIORITY 2: Deduct from budget (if within limit)
-- - If current_spend + reservation_amount > budget_limit: REJECT
-- - Otherwise: APPROVE and increment spend
--
-- CREDITS:
-- - Credits burn BEFORE budget
-- - Credits tracked separately for visibility (remaining balance)
--
-- UX:
-- - $0 balance + $0 request = ALLOW (cached responses, free operations)
-- ============================================================================

-- INPUTS
local budget_key = KEYS[1]                      -- e.g., "project_spend:uuid"
local credits_key = KEYS[2]                     -- e.g., "credits:org_id"
local reservation_amount = tonumber(ARGV[1])    -- Amount to reserve (can be 0)
local budget_limit = tonumber(ARGV[2])          -- Max spend allowed (0 = unlimited)
local organization_id = ARGV[3]                 -- For tracking

-- VALIDATION: Ensure all inputs are valid numbers
if not reservation_amount or reservation_amount < 0 then
    return {'INVALID_RESERVATION_AMOUNT', '0', '0', '0', '0'}
end

if not budget_limit or budget_limit < 0 then
    return {'INVALID_BUDGET_LIMIT', '0', '0', '0', '0'}
end

-- The counter is the project's total spend, mirrored to projects.current_spend
-- by the budget worker. A missing counter is never read as zero: the caller
-- seeds it from that mirror and runs the script again.
if redis.call('EXISTS', budget_key) == 0 then
    return {'SEED_REQUIRED', '0', '0', tostring(budget_limit), '0'}
end

-- Get current spend and credits
local current_spend = tonumber(redis.call('GET', budget_key) or '0')
local current_credits = tonumber(redis.call('GET', credits_key) or '0')

-- EDGE CASE #1: Free request (reservation_amount = 0)
if reservation_amount == 0 then
    return {'OK_FREE_REQUEST', tostring(current_spend), tostring(current_spend), tostring(budget_limit), tostring(current_credits)}
end

-- ============================================================================
-- CREDIT REDEMPTION (PRIORITY 1)
-- ============================================================================
-- If the organization has credits, burn them BEFORE touching budget
--
-- Examples:
-- - User has $10 credits, request costs $2 → Deduct from credits, now $8
-- - User has $1 credit, request costs $2 → Use $1 credit, charge $1 to budget
-- - User has $0 credits → Skip to budget deduction
-- ============================================================================

local credits_used = 0
local remaining_charge = reservation_amount

if current_credits > 0 then
    if current_credits >= reservation_amount then
        -- Fully covered by credits
        credits_used = reservation_amount
        remaining_charge = 0
        
        -- Deduct from credits atomically
        local new_credits = redis.call('INCRBYFLOAT', credits_key, -credits_used)
        
        return {'OK_CREDITS_USED', tostring(current_spend), tostring(current_spend), tostring(budget_limit), tostring(new_credits)}
    else
        -- Partially covered by credits
        credits_used = current_credits
        remaining_charge = reservation_amount - current_credits
        
        -- Deplete credits to zero atomically
        redis.call('SET', credits_key, '0')
    end
end

-- ============================================================================
-- BUDGET DEDUCTION (PRIORITY 2)
-- ============================================================================
-- If credits didn't cover the full amount, charge remaining to budget
-- ============================================================================

-- EDGE CASE #2: Unlimited budget (budget_limit = 0)
if budget_limit == 0 then
    -- Still increment spend for tracking, but no limit check
    local new_spend = redis.call('INCRBYFLOAT', budget_key, remaining_charge)
    local final_credits = tonumber(redis.call('GET', credits_key) or '0')
    
    if credits_used > 0 then
        return {'OK_CREDITS_PARTIAL', tostring(new_spend), tostring(current_spend), '0', tostring(final_credits)}
    else
        return {'OK_UNLIMITED', tostring(new_spend), tostring(current_spend), '0', tostring(final_credits)}
    end
end

-- CRITICAL BUDGET CHECK: Will remaining charge exceed limit?
local projected_spend = current_spend + remaining_charge

if projected_spend > budget_limit then
    -- REJECT if would exceed budget, return current state
    -- NOTE: Credits are NOT deducted if budget check fails (atomic rollback)
    return {'BUDGET_EXCEEDED', tostring(current_spend), tostring(current_spend), tostring(budget_limit), tostring(current_credits)}
end

-- ATOMIC OPERATION: Reserve budget (increment spend by remaining charge only)
local new_spend = redis.call('INCRBYFLOAT', budget_key, remaining_charge)
local final_credits = tonumber(redis.call('GET', credits_key) or '0')

if credits_used > 0 then
    return {'OK_CREDITS_PARTIAL', tostring(new_spend), tostring(current_spend), tostring(budget_limit), tostring(final_credits)}
else
    return {'OK', tostring(new_spend), tostring(current_spend), tostring(budget_limit), tostring(final_credits)}
end
"""


LUA_ADJUST_BUDGET_WITH_FLOOR = """
-- ============================================================================
-- LUA_ADJUST_BUDGET_WITH_FLOOR - ATOMIC BUDGET ADJUSTMENT
-- ============================================================================
-- PURPOSE: Adjust budget AFTER API call (refine estimate to actual cost)
-- Logic: 
-- 1. Increment by float.
-- 2. If result < 0 (floor hit), set to 0 to fix drift/refund errors.
-- ============================================================================

local budget_key = KEYS[1]
local adjustment = tonumber(ARGV[1])

if not adjustment then
    return {'INVALID_ADJUSTMENT', '0', '0'}
end

-- Never create the counter here: a counter that exists only because of an
-- adjustment would read as a near-zero total. The next reservation seeds it.
if redis.call('EXISTS', budget_key) == 0 then
    return {'MISSING', '0', '0'}
end

-- Get current spend just for reporting old value (optional, but good for audit)
local current_spend = tonumber(redis.call('GET', budget_key) or '0')

-- Apply adjustment atomic
local new_spend = redis.call('INCRBYFLOAT', budget_key, adjustment)
new_spend = tonumber(new_spend)

-- FLOOR PROTECTION
if new_spend < 0 then
    redis.call('SET', budget_key, '0')
    return {'FLOOR_HIT', '0', tostring(current_spend)}
end

return {'OK', tostring(new_spend), tostring(current_spend)}
"""


LUA_RETURN_BUDGET = """
-- ============================================================================
-- LUA_RETURN_BUDGET - ATOMIC BUDGET RETURN
-- ============================================================================
-- PURPOSE: Return reserved budget when request fails or is cached
-- ============================================================================

local budget_key = KEYS[1]
local amount = tonumber(ARGV[1])

if not amount or amount < 0 then
    return {'INVALID_RETURN_AMOUNT', '0', '0'}
end

if redis.call('EXISTS', budget_key) == 0 then
    return {'MISSING', '0', '0'}
end

local negative_amount = -amount
local current_spend = tonumber(redis.call('GET', budget_key) or '0')

-- Atomic Decrement
local new_spend = redis.call('INCRBYFLOAT', budget_key, negative_amount)
new_spend = tonumber(new_spend)

-- FLOOR PROTECTION
if new_spend < 0 then
    redis.call('SET', budget_key, '0')
    return {'FLOOR_HIT', '0', tostring(current_spend)}
end

return {'OK', tostring(new_spend), tostring(current_spend)}
"""


class BudgetUnavailable(Exception):
    """The budget cannot be checked (Redis or the spend mirror cannot answer).

    The request path refuses the request: a budget that cannot be checked is not
    spent. There is no database fallback for reservations: a second ledger in
    Postgres would let the same budget be spent once in each.
    """


def _text(value) -> str:
    return value.decode() if isinstance(value, bytes) else str(value)


class BudgetResult(TypedDict):
    status: str  # OK, BUDGET_EXCEEDED, FLOOR_HIT, ERROR
    current_spend: Decimal
    message: Optional[str]


class BudgetManager:
    """
    Redis-based budget manager with atomic operations.
    
    All budget operations use Lua scripts for atomicity.
    Optimization: Uses register_script (EVALSHA) for O(1) network overhead.
    """
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.log = logger.bind(component="budget_manager")
        
        # Pre-load scripts to use EVALSHA (save bandwidth)
        self._reserve_script = self.redis.register_script(LUA_RESERVE_BUDGET)
        self._adjust_script = self.redis.register_script(LUA_ADJUST_BUDGET_WITH_FLOOR)
        self._return_script = self.redis.register_script(LUA_RETURN_BUDGET)
    
    def _get_budget_key(self, project_id: str) -> str:
        return f"project_spend:{project_id}"
    
    def _get_credits_key(self, organization_id: str) -> str:
        """Credits are per-organization (shared across projects)."""
        return f"credits:{organization_id}"
    
    async def reserve_budget(
        self,
        project_id: str,
        organization_id: str,
        amount: Decimal,
        budget_limit: Decimal
    ) -> BudgetResult:
        """
        Atomically reserve budget using cached Lua script.
        
        Credits are checked and burned BEFORE budget.
        REDIS FAILOVER: If Redis is unavailable, falls back to database (slower, but functional).
        """
        budget_key = self._get_budget_key(project_id)
        credits_key = self._get_credits_key(organization_id)
        
        try:
            # Execute pre-loaded script
            # Returns: {status, new_spend, old_spend, limit, remaining_credits}
            for _attempt in range(2):
                result = await self._reserve_script(
                    keys=[budget_key, credits_key],
                    args=[str(amount), str(budget_limit), organization_id]
                )
                if _text(result[0]) != "SEED_REQUIRED":
                    break
                # No counter in Redis (first request, or Redis lost it): load the
                # project's spend from its Postgres mirror, then reserve again.
                await self._seed_spend_from_database(project_id, budget_key)
            else:
                raise BudgetUnavailable("spend counter could not be seeded")
            
            status = result[0]
            # Redis Lua returns match the order in script return {...}
            # Note: redis-py handles decoding if decode_responses=True is set on client,
            # but we handle bytes just in case.
            
            parsed_status = status.decode() if isinstance(status, bytes) else status
            
            # Handle invalid inputs from Lua
            if parsed_status.startswith("INVALID"):
                raise ValueError(f"Lua script validation failed: {parsed_status}")

            new_spend = Decimal(result[1].decode() if isinstance(result[1], bytes) else result[1])
            old_spend = Decimal(result[2].decode() if isinstance(result[2], bytes) else result[2])
            budget_limit_str = result[3].decode() if isinstance(result[3], bytes) else result[3]
            remaining_credits = Decimal(result[4].decode() if isinstance(result[4], bytes) else result[4])
            
            response: BudgetResult = {
                "status": parsed_status,
                "current_spend": new_spend,
                "message": None
            }

            if parsed_status == "BUDGET_EXCEEDED":
                response["message"] = f"Budget limit of ${budget_limit} exceeded."
                self.log.info(
                    "budget_exceeded",
                    project_id=project_id,
                    limit=str(budget_limit),
                    current_spend=str(new_spend),
                )
            elif parsed_status == "OK_CREDITS_USED":
                self.log.info(
                    "budget_reserved_credits_only",
                    project_id=project_id,
                    organization_id=organization_id,
                    amount=str(amount),
                    remaining_credits=str(remaining_credits),
                    message="Request fully covered by referral credits"
                )
            elif parsed_status == "OK_CREDITS_PARTIAL":
                self.log.info(
                    "budget_reserved_credits_partial",
                    project_id=project_id,
                    organization_id=organization_id,
                    amount=str(amount),
                    new_spend=str(new_spend),
                    remaining_credits=str(remaining_credits),
                    message="Request partially covered by credits"
                )
            else:
                self.log.info(
                    "budget_reserved",
                    project_id=project_id,
                    amount=str(amount),
                    status=parsed_status,
                    new_spend=str(new_spend)
                )
            
            return response
        
        except BudgetUnavailable:
            raise
        
        except RedisError as e:
            self.log.error(
                "redis_reservation_error",
                project_id=project_id,
                organization_id=organization_id,
                error=str(e),
                error_type=type(e).__name__,
                exc_info=True
            )
            raise e
        
        except Exception as e:
            # DEBUG: Catch any unexpected errors with full traceback
            self.log.error(
                "budget_reserve_unexpected_error",
                project_id=project_id,
                organization_id=organization_id,
                amount=str(amount),
                budget_limit=str(budget_limit),
                error=str(e),
                error_type=type(e).__name__,
                exc_info=True
            )
            raise e
    
    async def adjust_budget(
        self,
        project_id: str,
        adjustment: Decimal
    ) -> BudgetResult:
        """
        Atomically adjust budget using cached Lua script.
        """
        budget_key = self._get_budget_key(project_id)
        
        try:
            # Returns: {status, new_spend, old_spend}
            result = await self._adjust_script(
                keys=[budget_key],
                args=[str(adjustment)]
            )
            
            status = result[0].decode() if isinstance(result[0], bytes) else result[0]
            # FIX: Redis/fakeredis may return bytes - decode before Decimal
            val1 = result[1].decode('utf-8') if isinstance(result[1], bytes) else result[1]
            val2 = result[2].decode('utf-8') if isinstance(result[2], bytes) else result[2]
            new_spend = Decimal(val1)
            old_spend = Decimal(val2)
            
            if status == "FLOOR_HIT":
                self.log.error(
                    "budget_floor_hit",
                    project_id=project_id,
                    old_value=str(old_spend),
                    adjustment=str(adjustment),
                    msg="Spend went negative and was reset to 0."
                )
            else:
                self.log.info(
                    "budget_adjusted",
                    project_id=project_id,
                    old=str(old_spend),
                    new=str(new_spend),
                    adj=str(adjustment)
                )
            
            return {"status": status, "current_spend": new_spend, "message": None}

        except RedisError as e:
            self.log.error("redis_adjust_error", project_id=project_id, error=str(e))
            raise e

    async def return_budget(self, project_id: str, amount: Decimal) -> BudgetResult:
        """
        Atomically return budget using cached Lua script.
        """
        budget_key = self._get_budget_key(project_id)
        
        try:
            # Returns: {status, new_spend, old_spend}
            result = await self._return_script(
                keys=[budget_key],
                args=[str(amount)]
            )
            
            status = result[0].decode() if isinstance(result[0], bytes) else result[0]
            # FIX: Redis/fakeredis may return bytes - decode before Decimal
            val1 = result[1].decode('utf-8') if isinstance(result[1], bytes) else result[1]
            val2 = result[2].decode('utf-8') if isinstance(result[2], bytes) else result[2]
            new_spend = Decimal(val1)
            old_spend = Decimal(val2)
            
            if status == "FLOOR_HIT":
                self.log.error(
                    "budget_return_floor_hit",
                    project_id=project_id,
                    amount=str(amount),
                    old=str(old_spend),
                    msg="Spend went negative during return."
                )
            else:
                self.log.info(
                    "budget_returned",
                    project_id=project_id,
                    amount=str(amount),
                    new_spend=str(new_spend)
                )
                
            return {"status": status, "current_spend": new_spend, "message": None}
            
        except RedisError as e:
            self.log.error("redis_return_error", project_id=project_id, error=str(e))
            raise e

    async def get_current_spend(self, project_id: str) -> Decimal:
        """Non-atomic viewer for dashboards."""
        budget_key = self._get_budget_key(project_id)
        val = await self.redis.get(budget_key)
        return Decimal(val.decode("utf-8")) if val else Decimal("0.00")
    
    async def get_credits_balance(self, organization_id: str) -> Decimal:
        """
        Get current credit balance for organization.
        
        Shows how much referral credit the organization has left.
        """
        credits_key = self._get_credits_key(organization_id)
        val = await self.redis.get(credits_key)
        return Decimal(val.decode("utf-8")) if val else Decimal("0.00")
    
    async def add_credits(self, organization_id: str, amount: Decimal) -> Decimal:
        """
        Add credits to organization (e.g., from referral program).
        
        Called when a referral is redeemed.
        Returns new credit balance.
        """
        credits_key = self._get_credits_key(organization_id)
        
        try:
            new_balance = await self.redis.incrbyfloat(credits_key, float(amount))
            new_balance_decimal = Decimal(str(new_balance))
            
            self.log.info(
                "credits_added",
                organization_id=organization_id,
                amount=str(amount),
                new_balance=str(new_balance_decimal),
                message="Referral credits awarded"
            )
            
            return new_balance_decimal
            
        except RedisError as e:
            self.log.error("redis_add_credits_error", organization_id=organization_id, error=str(e))
            raise e
    
    async def _seed_spend_from_database(self, project_id: str, budget_key: str) -> None:
        """Create the Redis spend counter from projects.current_spend (SET NX).

        NX: if another request seeded it first, that value stands. Raises
        BudgetUnavailable when the database cannot answer.
        """
        from core import SUPABASE_URL, resources
        from dependencies import get_supabase_headers

        try:
            res = await resources.http_client.get(
                f"{SUPABASE_URL}/rest/v1/projects",
                params={"id": f"eq.{project_id}", "select": "current_spend", "limit": "1"},
                headers=get_supabase_headers(),
                timeout=5.0,
            )
            res.raise_for_status()
            rows = res.json() or []
        except Exception as e:
            raise BudgetUnavailable("projects.current_spend unreadable") from e
        if not rows:
            raise BudgetUnavailable("project not found")
        spend = Decimal(str(rows[0].get("current_spend") or "0"))
        await self.redis.set(budget_key, str(spend), nx=True)
        self.log.info("budget_counter_seeded", project_id=project_id, current_spend=str(spend))
