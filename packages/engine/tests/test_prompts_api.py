from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.prompts_v1 import router as prompts_router


def build_app(prompt_rows, members):
    app = FastAPI()
    app.include_router(prompts_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import prompts_v1 as p
    p.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, prompts, members):
            self.prompts = prompts
            self.members = members

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data

            if "organization_members" in url:
                return Res([{"user_id": m} for m in self.members])
            if "prompts" in url:
                # filtering logic by id / search / category (simplified)
                data = self.prompts
                if params:
                    if "id" in params:
                        id_val = params["id"].split(".")[-1]
                        data = [r for r in data if r["id"] == id_val]
                return Res(data)
            return Res([])

        async def post(self, url, headers=None, json=None):
            created = dict(json)
            created["id"] = "new-id"
            return type("R", (), {"status_code": 201, "json": lambda: [created], "raise_for_status": lambda: None})

        async def patch(self, url, params=None, headers=None, json=None):
            updated = self.prompts[0] | json
            updated["id"] = self.prompts[0]["id"]
            return type("R", (), {"status_code": 200, "json": lambda: [updated], "raise_for_status": lambda: None})

        async def delete(self, url, params=None, headers=None):
            return type("R", (), {"status_code": 204, "raise_for_status": lambda: None})

    p.resources.http_client = FakeHttpClient(prompt_rows, members)  # type: ignore
    return app


def base_prompt(id: str, author: str, verified=False):
    return {
        "id": id,
        "title": f"Prompt {id}",
        "description": "Desc",
        "category": "other",
        "prompt_text": "Do something helpful",
        "variables": [],
        "recommended_model": "gpt-4.1-mini",
        "estimated_cost_per_use": "0.001",
        "author_user_id": author,
        "author_name": "User",
        "is_verified": verified,
        "is_premium": False,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }


def test_list_prompts_filters_to_org_and_verified():
    prompts = [
        base_prompt("p1", "user-1", verified=False),
        base_prompt("p2", "user-2", verified=False),
        base_prompt("p3", "user-3", verified=True),
    ]
    app = build_app(prompts, members=["user-1"])
    client = TestClient(app)
    r = client.get("/v1/prompts", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["items"]]
    assert "p1" in ids
    assert "p3" in ids  # verified allowed
    assert "p2" not in ids  # not org member


def test_create_prompt():
    prompts = [base_prompt("p1", "user-1")]
    app = build_app(prompts, members=["user-1"])
    client = TestClient(app)
    body = {"name": "My Prompt", "description": "desc", "content": "do this now", "tags": ["support"]}
    r = client.post("/v1/prompts", json=body, headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 201
    assert r.json()["title"] == "My Prompt"


def test_update_and_delete_prompt():
    prompts = [base_prompt("p1", "user-1")]
    app = build_app(prompts, members=["user-1"])
    client = TestClient(app)
    r = client.patch("/v1/prompts/p1", json={"name": "Updated"}, headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"

    r2 = client.delete("/v1/prompts/p1", headers={"Authorization": "Bearer oxy_live_test"})
    assert r2.status_code == 204

