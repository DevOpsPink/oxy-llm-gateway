"""
No plan request quota on the request path.

The gateway used to refuse every request of an organization on the "free" plan
tier after 100,000 requests in a calendar month (403 free_plan_limit_reached),
a quota left from the hosted service. A self-hosted gateway does not cap an
organization's requests by a plan tier; budgets are the spend control.

The request runs through the real chat-completions route; everything outside
it (key lookup, organization status, provider key, logging) is stubbed. The
provider key is a "mock-" key, so the gateway answers without calling out.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core import resources


@pytest.fixture
def proxy_app(monkeypatch):
    from routes import proxy as p

    key = {
        "organization_id": "org-1", "project_id": "proj-1", "user_id": "user-1",
        "budget_limit": 0, "api_key": "oxy_live_test", "key_id": "key-1",
        "plan_tier": "free", "org_paused": False, "privacy_mode": "metadata_only",
    }

    async def usage(_org):
        return 10_000_000  # far past any monthly quota

    async def noop(*_a, **_k):
        return None

    async def org_active(_org):
        return {"status": "active"}

    async def allowed(**_k):
        return {"allowed": True, "status_code": 200, "org_status": "active"}

    async def mock_provider_key(_org, _provider):
        return "mock-key"

    for name, value in {"redis": None, "supabase": None, "http_client": None, "budget_manager": None,
                        "response_cache": None}.items():
        monkeypatch.setattr(resources, name, value, raising=False)
    monkeypatch.setattr(p, "get_user_and_key_from_api_key", lambda *_a: _ret(dict(key)))
    monkeypatch.setattr(p, "get_org_monthly_usage", usage)
    monkeypatch.setattr(p, "increment_org_monthly_usage", noop)
    monkeypatch.setattr(p, "get_org_status", org_active)
    monkeypatch.setattr(p, "check_execution_allowed", allowed)
    monkeypatch.setattr(p, "get_provider_api_key", mock_provider_key)
    monkeypatch.setattr(p, "log_request", noop)
    monkeypatch.setattr(p, "record_request", noop)

    app = FastAPI()
    app.include_router(p.router)
    return TestClient(app)


async def _ret(value):
    return value


def test_free_tier_organization_past_100k_requests_is_served(proxy_app):
    r = proxy_app.post(
        "/v1/chat/completions",
        json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Bearer oxy_live_test"},
    )
    assert r.status_code == 200, r.text
    assert "free_plan_limit_reached" not in r.text
