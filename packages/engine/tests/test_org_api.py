from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.org_v1 import router as org_router


def build_app(org_record):
    app = FastAPI()
    app.include_router(org_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import org_v1 as o
    o.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, org):
            self.org = org
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

    o.resources.http_client = FakeHttpClient(org_record)  # type: ignore
    return app


def test_get_org():
    org = {"id": "org-1", "name": "Oxy", "display_name": "Oxy Inc.", "slug": "oxy"}
    app = build_app(org)
    client = TestClient(app)
    r = client.get("/v1/org", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    assert r.json()["slug"] == "oxy"


def test_update_org_valid():
    org = {"id": "org-1", "name": "Oxy", "display_name": "Oxy Inc.", "slug": "oxy"}
    app = build_app(org)
    client = TestClient(app)
    r = client.post("/v1/org", json={"slug": "oxy-new", "support_email": "a@b.com"}, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["slug"] == "oxy-new"
    assert data["support_email"] == "a@b.com"


def test_update_org_invalid_slug():
    org = {"id": "org-1", "name": "Oxy"}
    app = build_app(org)
    client = TestClient(app)
    r = client.post("/v1/org", json={"slug": "Bad Slug"}, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 400

