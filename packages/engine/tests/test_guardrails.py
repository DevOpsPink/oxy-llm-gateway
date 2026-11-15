from fastapi.testclient import TestClient
from fastapi import FastAPI
from types import SimpleNamespace

from routes.guardrails import router as guardrails_router
from tests._roles import RoleAwareClient
from routes.proxy import router as proxy_router


class FakeTable:
    def __init__(self, rows):
        self.rows = rows
        self.filters = {}
        self._updates = None

    def select(self, _fields):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, _n):
        return self

    async def execute(self):  # the engine's PostgREST client is async
        data = [r for r in self.rows if all(r.get(k) == v for k, v in self.filters.items())]
        return SimpleNamespace(data=data)

    def update(self, payload):
        self._updates = payload
        for r in self.rows:
            if all(r.get(k) == v for k, v in self.filters.items()):
                r.update(payload)
        return self


class FakeSupabase:
    def __init__(self, orgs):
        self.orgs = orgs

    def table(self, name):
        if name == "organizations":
            return FakeTable(self.orgs)
        raise ValueError("unexpected table")


def build_app(orgs):
    app = FastAPI()
    app.include_router(guardrails_router)
    app.include_router(proxy_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import guardrails as g
    from routes import proxy as p
    g.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore
    p.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    # The caller owns the organization: require_org_admin lets the guardrails change.
    g.resources.http_client = RoleAwareClient(g.resources.http_client, "owner")  # type: ignore
    fake_sb = FakeSupabase(orgs)
    g.resources.supabase = fake_sb  # type: ignore
    p.resources.supabase = fake_sb  # type: ignore

    # Stub provider behavior to avoid outbound calls
    class DummyProvider:
        async def complete(self, **_kwargs):
            return {"choices": [{"message": {"content": "ok"}}]}
    from providers import provider_registry
    provider_registry._provider_instances = {"openai": DummyProvider()}

    return app


def test_guardrails_get_and_post():
    orgs = [{"id": "org-1", "paused": False, "auto_suspend_on_cost_spikes": True, "last_paused_at": None, "last_pause_reason": None}]
    app = build_app(orgs)
    client = TestClient(app)

    r = client.get("/v1/guardrails")
    assert r.status_code == 200
    data = r.json()
    assert data["paused"] is False

    r = client.post("/v1/guardrails", json={"paused": True, "auto_suspend_on_cost_spikes": False})
    assert r.status_code == 200
    data = r.json()
    assert data["paused"] is True
    assert data["auto_suspend_on_cost_spikes"] is False


def test_kill_switch_blocks_proxy():
    orgs = [{"id": "org-1", "paused": True, "status": "suspended", "auto_suspend_on_cost_spikes": True, "last_paused_at": None, "last_pause_reason": None}]
    app = build_app(orgs)
    client = TestClient(app)

    r = client.post("/v1/chat/completions", json={"model": "gpt-4", "messages": [{"role": "user", "content": "hi"}]}, headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "org_suspended"

