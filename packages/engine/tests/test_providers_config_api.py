from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.providers_v1 import router as providers_router


def build_app(org_row):
    app = FastAPI()
    app.include_router(providers_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import providers_v1 as p
    p.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, org_row):
            self.org = org_row
            self.last_patch = None

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data
            return Res([self.org])

        async def patch(self, url, params=None, headers=None, json=None):
            self.last_patch = json
            updated = self.org | json
            return type("R", (), {"status_code": 200, "json": lambda: [updated], "raise_for_status": lambda: None})

    p.resources.http_client = FakeHttpClient(org_row)  # type: ignore
    return app


def test_get_provider_config_defaults(monkeypatch):
    org = {
        "provider_openai_enabled": True,
        "provider_anthropic_enabled": False,
        "provider_google_enabled": False,
        "provider_local_enabled": False,
    }
    app = build_app(org)
    client = TestClient(app)
    monkeypatch.setenv("OPENAI_API_KEY", "x")
    r = client.get("/v1/providers/config", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["openai"]["enabled"] is True
    assert data["anthropic"]["enabled"] is False


def test_update_provider_config(monkeypatch):
    org = {
        "provider_openai_enabled": True,
        "provider_anthropic_enabled": False,
        "provider_google_enabled": False,
        "provider_local_enabled": False,
    }
    app = build_app(org)
    client = TestClient(app)
    monkeypatch.setenv("OPENAI_API_KEY", "x")
    r = client.post("/v1/providers/config", json={"google": {"enabled": True}}, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["google"]["enabled"] is True

