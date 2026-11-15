from fastapi.testclient import TestClient
from fastapi import FastAPI

from routes.proxy import router as proxy_router


def build_app(usage_value: int, plan: str = "free"):
    app = FastAPI()
    app.include_router(proxy_router)

    # Stub auth dependency
    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
            "plan_tier": plan,
            "org_paused": False,
        }

    from routes import proxy as p
    p.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    # Stub usage helpers
    async def fake_get_usage(_org_id: str):
        return usage_value

    async def fake_increment(_org_id: str):
        return None

    p.get_org_monthly_usage = fake_get_usage  # type: ignore
    p.increment_org_monthly_usage = fake_increment  # type: ignore

    # Stub provider to avoid external calls
    class DummyProvider:
        async def complete(self, **_kwargs):
            return {"choices": [{"message": {"content": "ok"}},]}

        async def stream(self, **_kwargs):
            yield b"data: ok\n\n"

    from providers import provider_registry
    provider_registry._provider_instances = {"openai": DummyProvider()}

    return app


def test_free_plan_under_limit_allows():
    app = build_app(usage_value=99_999)
    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        json={"model": "gpt-4", "messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Bearer oxy_live_test"},
    )
    assert r.status_code == 200
    assert r.headers.get("X-Oxy-Cache") is None


def test_free_plan_over_limit_blocked():
    app = build_app(usage_value=100_000)
    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        json={"model": "gpt-4", "messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Bearer oxy_live_test"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "free_plan_limit_reached"


def test_non_free_plan_not_blocked():
    app = build_app(usage_value=200_000, plan="starter")
    client = TestClient(app)
    r = client.post(
        "/v1/chat/completions",
        json={"model": "gpt-4", "messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Bearer oxy_live_test"},
    )
    assert r.status_code == 200

