import asyncio
from decimal import Decimal

import pytest

from core import resources
from core.costs import calculate_cost, record_request


class DummyBudgetManager:
    def __init__(self):
        self.calls = []

    async def adjust_budget(self, project_id: str, adjustment: Decimal):
        self.calls.append({"project_id": project_id, "adjustment": adjustment})
        return True


@pytest.fixture
def cost_env(mock_supabase_async):
    """Inject mock Supabase and dummy budget manager."""
    prev_supabase = resources.supabase
    prev_budget = resources.budget_manager
    resources.supabase = mock_supabase_async
    resources.budget_manager = DummyBudgetManager()
    try:
        yield resources
    finally:
        resources.supabase = prev_supabase
        resources.budget_manager = prev_budget


def test_calculate_cost_safe():
    cost = calculate_cost("gpt-4", 100, 50)
    assert isinstance(cost, Decimal)
    assert cost >= 0


@pytest.mark.asyncio
async def test_record_request_logs_and_adjusts(cost_env):
    res = cost_env
    user_id = "user-1"
    project_id = "proj-1"
    org_id = "org-1"
    api_key_id = "key-1"
    agent_id = "agent-1"
    session_id = "session-1"

    cost = Decimal("0.1234")
    reserved = Decimal("0.1000")

    await record_request(
        user_id=user_id,
        project_id=project_id,
        organization_id=org_id,
        api_key_id=api_key_id,
        agent_id=agent_id,
        session_id=session_id,
        model="gpt-4",
        provider="openai",
        status="success",
        threat="safe",
        threat_type="none",
        prompt_tokens=10,
        completion_tokens=5,
        cost=cost,
        subscription_id="sub-1",
        reserved_amount=reserved,
        cache_hit=False,
        cost_tags={"agent_id": agent_id, "project_id": project_id, "customer_id": "cust-1"},
    )

    table = res.supabase._tables["request_logs"]
    assert len(table) == 1
    row = table[0]
    assert row["organization_id"] == org_id
    assert row["api_key_id"] == api_key_id
    assert row["agent_id"] == agent_id
    assert row["session_id"] == session_id
    assert row["provider"] == "openai"
    assert row["model"] == "gpt-4"
    assert row["prompt_tokens"] == 10
    assert row["completion_tokens"] == 5
    assert row["cost_usd"] == float(cost)
    assert row["cost_tags"]["customer_id"] == "cust-1"
    assert row.get("prompt_snapshot") is None
    assert row.get("response_snapshot") is None

    # Budget adjustment called with delta
    calls = res.budget_manager.calls
    assert len(calls) == 1
    assert calls[0]["project_id"] == project_id
    assert calls[0]["adjustment"] == cost - reserved
