from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.cost_optimizer_v1 import router as optimizer_router


def build_app(rows):
    app = FastAPI()
    app.include_router(optimizer_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import cost_optimizer_v1 as c
    c.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, rows):
            self.rows = rows

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data
            return Res(self.rows)

    c.resources.http_client = FakeHttpClient(rows)  # type: ignore
    return app


def test_recommendations_basic():
    rows = [
        {
            "model": "gpt-4.1",
            "provider": "openai",
            "cost_usd": "100.0",
            "requests": 200,
            "prompt_tokens": 800,
            "completion_tokens": 200,
        },
        {
            "model": "gpt-4.1-mini",
            "provider": "openai",
            "cost_usd": "10.0",
            "requests": 100,
            "prompt_tokens": 400,
            "completion_tokens": 100,
        },
    ]
    app = build_app(rows)
    client = TestClient(app)
    r = client.get("/v1/cost-optimizer/recommendations?window=7d&limit=2", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    assert data["window"] == "7d"
    assert data["estimates_only"] is True
    assert len(data["recommendations"]) <= 2
    types = [rec["type"] for rec in data["recommendations"]]
    assert "model_switch" in types or "enable_caching" in types


def test_limit_enforced():
    rows = [{"model": "gpt-4.1", "provider": "openai", "cost_usd": "5", "requests": 10, "prompt_tokens": 10, "completion_tokens": 5}]
    app = build_app(rows)
    client = TestClient(app)
    r = client.get("/v1/cost-optimizer/recommendations?limit=1", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    assert len(r.json()["recommendations"]) <= 1


def test_caching_recommendation_when_volume_high():
    rows = [
        {
            "model": "gpt-4.1-mini",
            "provider": "openai",
            "cost_usd": "20.0",
            "requests": 200,
            "prompt_tokens": 200,
            "completion_tokens": 50,
        }
    ]
    app = build_app(rows)
    client = TestClient(app)
    r = client.get("/v1/cost-optimizer/recommendations", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    rec = data["recommendations"][0]
    assert rec["type"] in {"enable_caching", "model_switch", "rate_limit"}
    # Heuristic text should avoid guarantees
    assert "estimate" in rec["description"].lower()

