from decimal import Decimal
import asyncio
import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core import resources
from core.privacy_logging import DEFAULT_MODE
from core.control import mark_session_terminated
from routes import proxy as proxy_module
from routes.proxy import router as proxy_router
from providers import provider_registry


class DummyProvider:
    async def complete(self, **_kwargs):
        return {"choices": [{"message": {"content": "ok"}},], "usage": {"prompt_tokens": 5, "completion_tokens": 2}}

    async def stream(self, **_kwargs):
        yield b"data: ok\n\n"


def build_app():
    app = FastAPI()
    app.include_router(proxy_router)
    return app


@pytest.fixture(autouse=True)
def reset_resources(mock_supabase, mock_redis):
    prev_supabase = resources.supabase
    prev_redis = resources.redis
    resources.supabase = mock_supabase
    resources.redis = mock_redis
    provider_registry._provider_instances = {"openai": DummyProvider(), "anthropic": DummyProvider()}
    try:
        yield
    finally:
        resources.supabase = prev_supabase
        resources.redis = prev_redis


def test_cloud_agent_budget_blocks(monkeypatch):
    app = build_app()

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
            "privacy_mode": DEFAULT_MODE,
        }

    async def fake_get_org_usage(_org_id: str):
        return 100_001

    async def fake_increment(_org_id: str):
        return None

    monkeypatch.setattr(proxy_module, "get_user_and_key_from_api_key", lambda: fake_get_user_and_key())  # type: ignore
    monkeypatch.setattr(proxy_module, "get_org_monthly_usage", fake_get_org_usage)  # type: ignore
    monkeypatch.setattr(proxy_module, "increment_org_monthly_usage", fake_increment)  # type: ignore

    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer oxy_live_test"},
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] in ("free_plan_limit_reached", "free_plan_limit_reached")


def test_local_agent_zero_prompt_logging(monkeypatch, mock_supabase):
    app = build_app()

    class AllowBudget:
        async def check_or_reserve(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}
        async def reserve_budget(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}
        async def reserve_budget(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}

    monkeypatch.setattr(proxy_module, "budget_manager", AllowBudget())  # type: ignore
    monkeypatch.setattr(resources, "budget_manager", AllowBudget(), raising=False)
    async def allow_execution(*args, **kwargs):
        return {"status": "ok", "allowed": True}
    monkeypatch.setattr(proxy_module, "check_execution_allowed", allow_execution)  # type: ignore

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-2",
            "project_id": "proj-2",
            "user_id": "user-2",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
            "privacy_mode": "zero_prompt_logging",
        }

    async def fake_get_org_usage(_org_id: str):
        return 0

    async def fake_increment(_org_id: str):
        return None

    monkeypatch.setattr(proxy_module, "get_user_and_key_from_api_key", lambda: fake_get_user_and_key())  # type: ignore
    monkeypatch.setattr(proxy_module, "get_org_monthly_usage", fake_get_org_usage)  # type: ignore
    monkeypatch.setattr(proxy_module, "increment_org_monthly_usage", fake_increment)  # type: ignore

    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer oxy_live_test"},
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "secret prompt text"}]},
    )
    assert r.status_code == 200

    rows = mock_supabase._tables.get("request_logs", [])
    assert rows, "request log should be written"
    row = rows[0]
    assert row.get("prompt_snapshot") is None
    assert row.get("response_snapshot") is None
    assert row.get("privacy_mode") == "zero_prompt_logging"


def test_dlp_blocks_and_logs(monkeypatch, mock_supabase):
    app = build_app()

    class AllowBudget:
        async def check_or_reserve(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}
        async def reserve_budget(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}

    monkeypatch.setattr(proxy_module, "budget_manager", AllowBudget())  # type: ignore
    monkeypatch.setattr(resources, "budget_manager", AllowBudget(), raising=False)
    async def allow_execution(*args, **kwargs):
        return {"status": "ok", "allowed": True}
    monkeypatch.setattr(proxy_module, "check_execution_allowed", allow_execution)  # type: ignore

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-3",
            "project_id": "proj-3",
            "user_id": "user-3",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
            "privacy_mode": DEFAULT_MODE,
        }

    async def fake_get_org_usage(_org_id: str):
        return 0

    async def fake_increment(_org_id: str):
        return None

    monkeypatch.setattr(proxy_module, "get_user_and_key_from_api_key", lambda: fake_get_user_and_key())  # type: ignore
    monkeypatch.setattr(proxy_module, "get_org_monthly_usage", fake_get_org_usage)  # type: ignore
    monkeypatch.setattr(proxy_module, "increment_org_monthly_usage", fake_increment)  # type: ignore

    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer oxy_live_test"},
        json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "my card number is 4111-1111-1111-1111"}],
        },
    )
    assert r.status_code == 451
    body = r.json()
    assert body["error"]["code"] == "DLP_BLOCKED"

    rows = mock_supabase._tables.get("request_logs", [])
    assert rows, "blocked request should be logged"
    row = rows[0]
    assert row.get("threat_type") != "none"
    assert row.get("status") == "blocked"


def test_dlp_log_mode_allows(monkeypatch, mock_supabase):
    app = build_app()

    class AllowBudget:
        async def check_or_reserve(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}
        async def reserve_budget(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}

    monkeypatch.setattr(proxy_module, "budget_manager", AllowBudget())  # type: ignore
    monkeypatch.setattr(resources, "budget_manager", AllowBudget(), raising=False)
    async def allow_execution(*args, **kwargs):
        return {"status": "ok", "allowed": True}
    monkeypatch.setattr(proxy_module, "check_execution_allowed", allow_execution)  # type: ignore

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-6",
            "project_id": "proj-6",
            "user_id": "user-6",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
            "privacy_mode": DEFAULT_MODE,
            "dlp_mode": "log",
        }

    async def fake_get_org_usage(_org_id: str):
        return 0

    async def fake_increment(_org_id: str):
        return None

    monkeypatch.setattr(proxy_module, "get_user_and_key_from_api_key", lambda: fake_get_user_and_key())  # type: ignore
    monkeypatch.setattr(proxy_module, "get_org_monthly_usage", fake_get_org_usage)  # type: ignore
    monkeypatch.setattr(proxy_module, "increment_org_monthly_usage", fake_increment)  # type: ignore

    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer oxy_live_test"},
        json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "my card number is 4111-1111-1111-1111"}],
        },
    )
    assert r.status_code == 200

    rows = mock_supabase._tables.get("request_logs", [])
    assert rows, "request log should be written"
    row = rows[0]
    assert row.get("threat_type") != "none"
    assert row.get("status") == "success"


def test_kill_switch_blocks_session(monkeypatch, mock_supabase, mock_redis):
    app = build_app()
    session_id = "session-to-kill"

    class AllowBudget:
        async def check_or_reserve(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}
        async def reserve_budget(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}

    monkeypatch.setattr(proxy_module, "budget_manager", AllowBudget())  # type: ignore
    monkeypatch.setattr(resources, "budget_manager", AllowBudget(), raising=False)
    async def allow_execution(*args, **kwargs):
        return {"status": "ok", "allowed": True}
    monkeypatch.setattr(proxy_module, "check_execution_allowed", allow_execution)  # type: ignore

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-4",
            "project_id": "proj-4",
            "user_id": "user-4",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
            "privacy_mode": DEFAULT_MODE,
        }

    async def fake_get_org_usage(_org_id: str):
        return 0

    async def fake_increment(_org_id: str):
        return None

    monkeypatch.setattr(proxy_module, "get_user_and_key_from_api_key", lambda: fake_get_user_and_key())  # type: ignore
    monkeypatch.setattr(proxy_module, "get_org_monthly_usage", fake_get_org_usage)  # type: ignore
    monkeypatch.setattr(proxy_module, "increment_org_monthly_usage", fake_increment)  # type: ignore

    # Mark session as terminated (kill switch)
    asyncio.run(mark_session_terminated(session_id, 3600))

    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer oxy_live_test", "X-Oxy-Session-Id": session_id},
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 410 or r.status_code == 409
    assert r.json()["error"]["code"] in ("session_terminated", "SESSION_KILLED")


def test_debug_full_stores_text_when_enabled(monkeypatch, mock_supabase):
    app = build_app()
    os.environ["OXY_DEBUG_FULL_LOGS"] = "1"

    class AllowBudget:
        async def check_or_reserve(self, *args, **kwargs):
            return {"allowed": True, "budget_limit": 1000}

    monkeypatch.setattr(proxy_module, "budget_manager", AllowBudget())  # type: ignore
    monkeypatch.setattr(resources, "budget_manager", AllowBudget(), raising=False)
    async def allow_execution(*args, **kwargs):
        return {"status": "ok", "allowed": True}
    monkeypatch.setattr(proxy_module, "check_execution_allowed", allow_execution)  # type: ignore

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-5",
            "project_id": "proj-5",
            "user_id": "user-5",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
            "privacy_mode": "debug_full",
        }

    async def fake_get_org_usage(_org_id: str):
        return 0

    async def fake_increment(_org_id: str):
        return None

    monkeypatch.setattr(proxy_module, "get_user_and_key_from_api_key", lambda: fake_get_user_and_key())  # type: ignore
    monkeypatch.setattr(proxy_module, "get_org_monthly_usage", fake_get_org_usage)  # type: ignore
    monkeypatch.setattr(proxy_module, "increment_org_monthly_usage", fake_increment)  # type: ignore

    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer oxy_live_test"},
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "capture me"}]},
    )
    assert r.status_code == 200

    rows = mock_supabase._tables.get("request_logs", [])
    assert rows, "request log should be written"
    row = rows[0]
    assert row.get("prompt_snapshot") is not None
    assert "capture me" in (row.get("prompt_snapshot") or "")
    assert row.get("privacy_mode") == "debug_full"
    os.environ.pop("OXY_DEBUG_FULL_LOGS", None)
