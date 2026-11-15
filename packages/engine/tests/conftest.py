"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🧪 PYTEST CONFIGURATION - Test Fixtures for Oxy Engine                    ║
║   Shared fixtures: fakeredis, mocked Supabase, HTTP clients                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

Provides mock fixtures for:
- Redis (using fakeredis)
- Supabase client (using unittest.mock)
- HTTP clients

Run tests with:
    pytest packages/engine/tests/ -v --tb=short
"""

import asyncio
import json
import os
from decimal import Decimal
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# The engine reads its configuration at import time. Offline tests never reach
# Supabase, so placeholders are enough; values already in the environment win.
os.environ.setdefault("SUPABASE_URL", "http://localhost:8080")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "offline-test-placeholder")


# ============================================================================
# EVENT LOOP CONFIGURATION
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# REDIS MOCK FIXTURES
# ============================================================================

class FakeRedisClient:
    """
    In-memory Redis mock for testing atomic budget operations.
    
    Supports:
    - GET/SET/INCRBYFLOAT operations
    - Lua script execution (register_script)
    - Async interface
    """
    
    def __init__(self):
        self._data: Dict[str, str] = {}
        self._scripts: Dict[str, str] = {}
    
    async def get(self, key: str) -> Optional[bytes]:
        """Get value by key."""
        value = self._data.get(key)
        return value.encode() if value else None
    
    async def set(self, key: str, value: str) -> bool:
        """Set value."""
        self._data[key] = str(value)
        return True
    
    async def setex(self, key: str, ttl: int, value: str) -> bool:
        """Set value with expiry (ttl ignored in mock)."""
        self._data[key] = str(value)
        return True
    
    async def incrbyfloat(self, key: str, amount: float) -> float:
        """Increment float value."""
        current = float(self._data.get(key, "0"))
        new_value = current + amount
        self._data[key] = str(new_value)
        return new_value
    
    async def delete(self, *keys: str) -> int:
        """Delete keys."""
        count = 0
        for key in keys:
            if key in self._data:
                del self._data[key]
                count += 1
        return count
    
    async def exists(self, key: str) -> int:
        """Check if key exists."""
        return 1 if key in self._data else 0
    
    async def keys(self, pattern: str) -> list:
        """Get keys matching pattern (simplified)."""
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            return [k for k in self._data.keys() if k.startswith(prefix)]
        return [pattern] if pattern in self._data else []
    
    def register_script(self, script: str):
        """
        Register a Lua script and return a callable.
        
        This is a simplified mock that simulates the Lua script behavior
        for testing purposes.
        """
        return FakeLuaScript(self, script)


class FakeLuaScript:
    """
    Mock Lua script executor.
    
    Simulates the behavior of Redis Lua scripts for budget operations.
    """
    
    def __init__(self, redis: FakeRedisClient, script: str):
        self.redis = redis
        self.script = script
        
        # Detect script type by checking for key patterns
        if "INVALID_RESERVATION_AMOUNT" in script:
            self.script_type = "reserve"
        elif "INVALID_ADJUSTMENT" in script:
            self.script_type = "adjust"
        elif "INVALID_RETURN_AMOUNT" in script:
            self.script_type = "return"
        else:
            self.script_type = "unknown"
    
    async def __call__(self, keys: list, args: list) -> list:
        """Execute the mock Lua script."""
        
        if self.script_type == "reserve":
            return await self._execute_reserve(keys, args)
        elif self.script_type == "adjust":
            return await self._execute_adjust(keys, args)
        elif self.script_type == "return":
            return await self._execute_return(keys, args)
        else:
            raise ValueError(f"Unknown script type: {self.script_type}")
    
    async def _execute_reserve(self, keys: list, args: list) -> list:
        """
        Mock LUA_RESERVE_BUDGET script.
        
        Returns: [status, new_spend, old_spend, limit, remaining_credits]
        """
        budget_key = keys[0]
        credits_key = keys[1]
        
        reservation_amount = float(args[0])
        budget_limit = float(args[1])
        
        # Validation
        if reservation_amount < 0:
            return [b"INVALID_RESERVATION_AMOUNT", b"0", b"0", b"0", b"0"]
        
        if budget_limit < 0:
            return [b"INVALID_BUDGET_LIMIT", b"0", b"0", b"0", b"0"]
        
        # Get current values
        current_spend_raw = await self.redis.get(budget_key)
        current_spend = float(current_spend_raw.decode()) if current_spend_raw else 0.0
        
        current_credits_raw = await self.redis.get(credits_key)
        current_credits = float(current_credits_raw.decode()) if current_credits_raw else 0.0
        
        # Free request
        if reservation_amount == 0:
            return [
                b"OK_FREE_REQUEST",
                str(current_spend).encode(),
                str(current_spend).encode(),
                str(budget_limit).encode(),
                str(current_credits).encode()
            ]
        
        # Credit logic
        credits_used = 0.0
        remaining_charge = reservation_amount
        
        if current_credits > 0:
            if current_credits >= reservation_amount:
                credits_used = reservation_amount
                remaining_charge = 0.0
                new_credits = current_credits - credits_used
                await self.redis.set(credits_key, str(new_credits))
                
                return [
                    b"OK_CREDITS_USED",
                    str(current_spend).encode(),
                    str(current_spend).encode(),
                    str(budget_limit).encode(),
                    str(new_credits).encode()
                ]
            else:
                credits_used = current_credits
                remaining_charge = reservation_amount - current_credits
                await self.redis.set(credits_key, "0")
        
        # Unlimited budget
        if budget_limit == 0:
            new_spend = await self.redis.incrbyfloat(budget_key, remaining_charge)
            final_credits_raw = await self.redis.get(credits_key)
            final_credits = float(final_credits_raw.decode()) if final_credits_raw else 0.0
            
            if credits_used > 0:
                return [
                    b"OK_CREDITS_PARTIAL",
                    str(new_spend).encode(),
                    str(current_spend).encode(),
                    b"0",
                    str(final_credits).encode()
                ]
            else:
                return [
                    b"OK_UNLIMITED",
                    str(new_spend).encode(),
                    str(current_spend).encode(),
                    b"0",
                    str(final_credits).encode()
                ]
        
        # Budget check
        projected_spend = current_spend + remaining_charge
        
        if projected_spend > budget_limit:
            return [
                b"BUDGET_EXCEEDED",
                str(current_spend).encode(),
                str(current_spend).encode(),
                str(budget_limit).encode(),
                str(current_credits).encode()
            ]
        
        # Reserve budget
        new_spend = await self.redis.incrbyfloat(budget_key, remaining_charge)
        final_credits_raw = await self.redis.get(credits_key)
        final_credits = float(final_credits_raw.decode()) if final_credits_raw else 0.0
        
        if credits_used > 0:
            return [
                b"OK_CREDITS_PARTIAL",
                str(new_spend).encode(),
                str(current_spend).encode(),
                str(budget_limit).encode(),
                str(final_credits).encode()
            ]
        else:
            return [
                b"OK",
                str(new_spend).encode(),
                str(current_spend).encode(),
                str(budget_limit).encode(),
                str(final_credits).encode()
            ]
    
    async def _execute_adjust(self, keys: list, args: list) -> list:
        """
        Mock LUA_ADJUST_BUDGET_WITH_FLOOR script.
        
        Returns: [status, new_spend, old_spend]
        """
        budget_key = keys[0]
        
        try:
            adjustment = float(args[0])
        except (ValueError, TypeError):
            return [b"INVALID_ADJUSTMENT", b"0", b"0"]
        
        current_spend_raw = await self.redis.get(budget_key)
        current_spend = float(current_spend_raw.decode()) if current_spend_raw else 0.0
        
        new_spend = current_spend + adjustment
        
        if new_spend < 0:
            await self.redis.set(budget_key, "0")
            return [b"FLOOR_HIT", b"0", str(current_spend).encode()]
        
        await self.redis.set(budget_key, str(new_spend))
        return [b"OK", str(new_spend).encode(), str(current_spend).encode()]
    
    async def _execute_return(self, keys: list, args: list) -> list:
        """
        Mock LUA_RETURN_BUDGET script.
        
        Returns: [status, new_spend, old_spend]
        """
        budget_key = keys[0]
        
        try:
            amount = float(args[0])
        except (ValueError, TypeError):
            return [b"INVALID_RETURN_AMOUNT", b"0", b"0"]
        
        if amount < 0:
            return [b"INVALID_RETURN_AMOUNT", b"0", b"0"]
        
        current_spend_raw = await self.redis.get(budget_key)
        current_spend = float(current_spend_raw.decode()) if current_spend_raw else 0.0
        
        new_spend = current_spend - amount
        
        if new_spend < 0:
            await self.redis.set(budget_key, "0")
            return [b"FLOOR_HIT", b"0", str(current_spend).encode()]
        
        await self.redis.set(budget_key, str(new_spend))
        return [b"OK", str(new_spend).encode(), str(current_spend).encode()]


@pytest_asyncio.fixture
async def mock_redis():
    """Provide a fake Redis client for testing."""
    client = FakeRedisClient()
    yield client


@pytest.fixture
def mock_redis_sync():
    """Provide a sync fake Redis client for non-async tests."""
    return FakeRedisClient()


# ============================================================================
# SUPABASE MOCK FIXTURES
# ============================================================================

class MockSupabaseResponse:
    """Mock Supabase response object."""
    
    def __init__(self, data: Any = None, error: Any = None):
        self.data = data
        self.error = error


class MockSupabaseClient:
    """
    Mock Supabase client for testing database operations.
    
    Provides in-memory storage for testing without real database.
    """
    
    def __init__(self):
        self._tables: Dict[str, list] = {}
        self._rpc_handlers: Dict[str, callable] = {}
    
    def table(self, name: str) -> "MockSupabaseTable":
        """Get a table builder."""
        if name not in self._tables:
            self._tables[name] = []
        return MockSupabaseTable(self._tables[name])
    
    async def rpc(self, function_name: str, params: dict) -> MockSupabaseResponse:
        """Call an RPC function."""
        if function_name in self._rpc_handlers:
            result = self._rpc_handlers[function_name](params)
            return MockSupabaseResponse(data=result)
        return MockSupabaseResponse(data=None)
    
    def register_rpc(self, function_name: str, handler: callable):
        """Register a mock RPC handler for testing."""
        self._rpc_handlers[function_name] = handler


class MockSupabaseTable:
    """Mock Supabase table query builder."""
    
    def __init__(self, data: list):
        self._data = data
        self._filters = []
        self._insert_data = None
        self._update_data = None
        self._select_columns = "*"
        self._limit_val = None
        self._single = False
    
    def select(self, columns: str = "*") -> "MockSupabaseTable":
        self._select_columns = columns
        return self
    
    def insert(self, data: dict) -> "MockSupabaseTable":
        self._insert_data = data
        return self
    
    def update(self, data: dict) -> "MockSupabaseTable":
        self._update_data = data
        return self
    
    def upsert(self, data: dict, on_conflict: str = None) -> "MockSupabaseTable":
        self._insert_data = data
        return self
    
    def eq(self, column: str, value: Any) -> "MockSupabaseTable":
        self._filters.append((column, "eq", value))
        return self
    
    def limit(self, count: int) -> "MockSupabaseTable":
        self._limit_val = count
        return self
    
    def single(self) -> "MockSupabaseTable":
        self._single = True
        return self
    
    async def execute(self) -> MockSupabaseResponse:
        """Execute the query."""
        if self._insert_data:
            self._data.append(self._insert_data)
            return MockSupabaseResponse(data=[self._insert_data])
        
        if self._update_data:
            # Apply update to matching records
            for record in self._data:
                matches = True
                for col, op, val in self._filters:
                    if op == "eq" and record.get(col) != val:
                        matches = False
                        break
                if matches:
                    record.update(self._update_data)
            return MockSupabaseResponse(data=[self._update_data])
        
        # SELECT query
        results = []
        for record in self._data:
            matches = True
            for col, op, val in self._filters:
                if op == "eq" and record.get(col) != val:
                    matches = False
                    break
            if matches:
                results.append(record)
        
        if self._limit_val:
            results = results[:self._limit_val]
        
        if self._single:
            return MockSupabaseResponse(data=results[0] if results else None)
        
        return MockSupabaseResponse(data=results)


@pytest.fixture
def mock_supabase():
    """Provide a mock Supabase client."""
    return MockSupabaseClient()


@pytest_asyncio.fixture
async def mock_supabase_async():
    """Provide a mock Supabase client for async tests."""
    return MockSupabaseClient()


# ============================================================================
# BUDGET MANAGER FIXTURE
# ============================================================================

@pytest_asyncio.fixture
async def budget_manager(mock_redis):
    """
    Provide a BudgetManager instance with mock Redis.
    
    Usage:
        async def test_budget(budget_manager):
            result = await budget_manager.reserve_budget(...)
    """
    from core.budget import BudgetManager
    manager = BudgetManager(mock_redis)
    yield manager


# ============================================================================
# TEST DATA FIXTURES
# ============================================================================

@pytest.fixture
def test_project_id():
    """Provide a test project UUID."""
    return "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture
def test_organization_id():
    """Provide a test organization UUID."""
    return "6ba7b810-9dad-11d1-80b4-00c04fd430c8"


@pytest.fixture
def test_user_id():
    """Provide a test user UUID."""
    return "f47ac10b-58cc-4372-a567-0e02b2c3d479"


@pytest.fixture
def sample_subscription():
    """Provide sample subscription data."""
    return {
        "id": "sub_test123",
        "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "stripe_customer_id": "cus_test123",
        "stripe_subscription_id": "sub_test123",
        "plan_tier": "professional",
        "status": "active",
        "interval": "month",
        "current_period_start": "2025-01-01T00:00:00Z",
        "current_period_end": "2025-02-01T00:00:00Z",
        "cancel_at_period_end": False,
        "trial_end": None
    }
