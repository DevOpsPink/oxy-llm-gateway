import pytest

from core import resources
from core.control import (
    check_execution_allowed,
    is_session_terminated,
    mark_session_terminated,
)


@pytest.fixture
def control_env(mock_redis, mock_supabase_async):
    """Setup shared resources for control-plane tests."""
    prev_redis = resources.redis
    prev_supabase = resources.supabase
    resources.redis = mock_redis
    resources.supabase = mock_supabase_async
    try:
        yield mock_supabase_async
    finally:
        resources.redis = prev_redis
        resources.supabase = prev_supabase


@pytest.mark.asyncio
async def test_check_execution_allows_active(control_env):
    supabase = control_env
    org_id = "org-active"
    agent_id = "agent-active"

    await supabase.table("organizations").insert({"id": org_id, "status": "active"}).execute()
    await supabase.table("agents").insert({"id": agent_id, "status": "active"}).execute()

    result = await check_execution_allowed(org_id=org_id, agent_id=agent_id, session_id=None)
    assert result["allowed"] is True
    assert result["status_code"] == 200


@pytest.mark.asyncio
async def test_check_execution_blocks_suspended_org(control_env):
    supabase = control_env
    org_id = "org-suspended"

    await supabase.table("organizations").insert(
        {"id": org_id, "status": "suspended", "suspend_reason": "maintenance"}
    ).execute()

    result = await check_execution_allowed(org_id=org_id, agent_id=None, session_id=None)
    assert result["allowed"] is False
    assert result["code"] == "org_suspended"
    assert result["reason"] == "maintenance"


@pytest.mark.asyncio
async def test_check_execution_blocks_suspended_agent(control_env):
    supabase = control_env
    org_id = "org-ok"
    agent_id = "agent-suspended"

    await supabase.table("organizations").insert({"id": org_id, "status": "active"}).execute()
    await supabase.table("agents").insert({"id": agent_id, "status": "suspended"}).execute()

    result = await check_execution_allowed(org_id=org_id, agent_id=agent_id, session_id=None)
    assert result["allowed"] is False
    assert result["code"] == "agent_suspended"


@pytest.mark.asyncio
async def test_check_execution_blocks_terminated_session(control_env):
    supabase = control_env
    org_id = "org-ok"
    agent_id = "agent-active"
    session_id = "session-killed"

    await supabase.table("organizations").insert({"id": org_id, "status": "active"}).execute()
    await supabase.table("agents").insert({"id": agent_id, "status": "active"}).execute()
    await mark_session_terminated(session_id, ttl_seconds=60)

    result = await check_execution_allowed(org_id=org_id, agent_id=agent_id, session_id=session_id)
    assert result["allowed"] is False
    assert result["code"] == "session_terminated"
    assert result["status_code"] == 409


@pytest.mark.asyncio
async def test_streaming_stops_on_termination(control_env):
    session_id = "session-stream"
    collected: list[str] = []

    async def provider():
        for i in range(4):
            yield f"chunk-{i}"

    async for chunk in provider():
        # Check termination flag at the start of each iteration
        if await is_session_terminated(session_id):
            break
        collected.append(chunk)
        if chunk == "chunk-1":
            await mark_session_terminated(session_id, ttl_seconds=60)

    assert collected == ["chunk-0", "chunk-1"]
