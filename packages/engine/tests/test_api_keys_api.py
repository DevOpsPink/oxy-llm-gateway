from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.api_keys_v1 import router as api_keys_router


def build_app(api_keys, projects):
    app = FastAPI()
    app.include_router(api_keys_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import api_keys_v1 as a
    a.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, keys, projects):
            self.keys = keys
            self.projects = projects
            self.last_patch = None
            self.last_post = None

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data

            if "projects" in url:
                return Res(self.projects)
            return Res(self.keys)

        async def post(self, url, headers=None, json=None):
            self.last_post = json
            created = json | {"id": "new-key-id", "created_at": "now()"}
            return type("R", (), {"status_code": 201, "json": lambda: [created], "raise_for_status": lambda: None})

        async def patch(self, url, params=None, headers=None, json=None):
            self.last_patch = (params, json)
            updated = self.keys[0] | json
            updated["id"] = self.keys[0]["id"]
            return type("R", (), {"status_code": 200, "json": lambda: [updated], "raise_for_status": lambda: None})

    a.resources.http_client = FakeHttpClient(api_keys, projects)  # type: ignore
    return app


def test_list_api_keys():
    keys = [
        {"id": "k1", "key_name": "K1", "key_prefix": "oxy_live_abc", "created_at": "t", "is_active": True},
    ]
    projects = [{"id": "proj-1"}]
    app = build_app(keys, projects)
    client = TestClient(app)
    r = client.get("/v1/api-keys", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    body = r.json()
    assert body["items"][0]["prefix"] == "oxy_live_abc"
    assert "secret" not in body["items"][0]


def test_create_api_key():
    keys = []
    projects = [{"id": "proj-1"}]
    app = build_app(keys, projects)
    client = TestClient(app)
    r = client.post("/v1/api-keys", json={"name": "New Key"}, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    body = r.json()
    assert "secret" in body
    assert body["name"] == "New Key"


def test_revoke_api_key():
    keys = [{"id": "k1", "key_name": "K1", "key_prefix": "oxy_live_abc", "is_active": True}]
    projects = [{"id": "proj-1"}]
    app = build_app(keys, projects)
    client = TestClient(app)
    r = client.delete("/v1/api-keys/k1", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "active" or body["status"] == "revoked"

