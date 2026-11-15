from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.privacy import router as privacy_router


def build_app(org_record):
    app = FastAPI()
    app.include_router(privacy_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import privacy as p
    p.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, org):
            self.org = org
            self.updated = None

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
            self.updated = json
            updated = self.org | json
            return type("R", (), {"status_code": 200, "json": lambda: [updated], "raise_for_status": lambda: None})

    p.resources.http_client = FakeHttpClient(org_record)  # type: ignore
    return app


def test_privacy_get_defaults():
    org = {"privacy_mode": "metadata_only", "request_log_retention_days": 365}
    app = build_app(org)
    client = TestClient(app)
    r = client.get("/v1/privacy", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    assert data["privacy_mode"] == "metadata_only"
    assert data["request_log_retention_days"] == 365


def test_privacy_update():
    org = {"privacy_mode": "metadata_only", "request_log_retention_days": 365}
    app = build_app(org)
    client = TestClient(app)
    r = client.post("/v1/privacy", json={"privacy_mode": "zero_prompt_logging", "request_log_retention_days": 30}, headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    assert data["privacy_mode"] == "zero_prompt_logging"
    assert data["request_log_retention_days"] == 30


def test_privacy_invalid_mode_rejected():
    org = {"privacy_mode": "metadata_only", "request_log_retention_days": 365}
    app = build_app(org)
    client = TestClient(app)
    r = client.post("/v1/privacy", json={"privacy_mode": "bad_mode"}, headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 400

