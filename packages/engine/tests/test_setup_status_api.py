from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.setup_v1 import router as setup_router


def build_app(fake_org):
    app = FastAPI()
    app.include_router(setup_router)

    # Patch org fetcher
    from routes import setup_v1 as setup
    async def fake_fetch_org(org_id: str):
        return fake_org
    setup._fetch_org = fake_fetch_org  # type: ignore

    # Patch auth dependency
    async def fake_key_dep():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }
    setup.api_key_dependency = lambda: fake_key_dep()  # type: ignore
    return app


def test_setup_status_all_false():
    org = {
        "providers_enabled": False,
        "guardrails_enabled": False,
        "privacy_mode": None,
        "billing_plan": None,
        "sso_enabled": False,
    }
    client = TestClient(build_app(org))
    resp = client.get("/v1/setup/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["completed"] is False
    assert "providers" in data["steps"][0]["id"]
    assert "incomplete_required_steps" in data
    assert set(data["incomplete_required_steps"]) >= {"providers", "guardrails_privacy", "billing"}


def test_setup_status_partial_and_sso_optional():
    org = {
        "providers_enabled": True,
        "guardrails_enabled": True,
        "privacy_mode": "metadata_only",
        "billing_plan": "pro",
        "sso_enabled": False,  # optional
    }
    client = TestClient(build_app(org))
    resp = client.get("/v1/setup/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["completed"] is True  # optional SSO should not block completion
    steps = {s["id"]: s for s in data["steps"]}
    assert steps["sso"]["optional"] is True
    assert steps["providers"]["completed"] is True
    assert steps["guardrails_privacy"]["completed"] is True
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.setup_v1 import router as setup_router


def build_app(org_record):
    app = FastAPI()
    app.include_router(setup_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import setup_v1 as s
    s.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, org):
            self.org = org

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

    s.resources.http_client = FakeHttpClient(org_record)  # type: ignore
    return app


def test_setup_status_completed():
    org = {
        "settings": {"openai_api_key": "x"},
        "auto_suspend_on_cost_spikes": True,
        "privacy_mode": "metadata_only",
        "request_log_retention_days": 365,
        "subscription_plan": "free",
        "sso_enabled": False,
        "sso_domain": None,
    }
    app = build_app(org)
    client = TestClient(app)
    r = client.get("/v1/setup/status", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["completed"] is True
    assert data["incomplete_required_steps"] == []


def test_setup_status_missing_providers_and_privacy_debug():
    org = {
        "settings": {},
        "auto_suspend_on_cost_spikes": None,
        "privacy_mode": "debug_full",
        "request_log_retention_days": 10,
        "subscription_plan": "free",
        "sso_enabled": False,
        "sso_domain": None,
    }
    app = build_app(org)
    client = TestClient(app)
    r = client.get("/v1/setup/status", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["completed"] is False
    assert "providers" in data["incomplete_required_steps"]
    assert "privacy" in data["incomplete_required_steps"]
    # SSO optional should not block completion list

