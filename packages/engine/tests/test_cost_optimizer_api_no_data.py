from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.cost_optimizer_v1 import router as optimizer_router


def build_app(rows):
    app = FastAPI()
    app.include_router(optimizer_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-empty",
            "project_id": "proj-empty",
            "user_id": "user-empty",
            "budget_limit": 0,
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


def test_cost_optimizer_handles_no_data_gracefully():
    app = build_app([])
    client = TestClient(app)
    r = client.get("/v1/cost-optimizer/recommendations", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    assert data["estimates_only"] is True
    assert data["recommendations"] == []
    assert data["estimated_total_savings_usd"] == 0


