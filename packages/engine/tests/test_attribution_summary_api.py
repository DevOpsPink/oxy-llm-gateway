from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.attribution_summary import router as attribution_router


def build_app(tag_rows, attribution_rows):
    app = FastAPI()
    app.include_router(attribution_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import attribution_summary as a
    a.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, tag_rows, attribution_rows):
            self.tag_rows = tag_rows
            self.attr_rows = attribution_rows

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data
            if "cost_attribution_tags" in url:
                return Res(self.tag_rows)
            return Res(self.attr_rows)

    a.resources.http_client = FakeHttpClient(tag_rows, attribution_rows)  # type: ignore
    return app


def test_attribution_summary_sorted_and_limited():
    tags = [
        {"id": "t1", "key": "customer", "value": "acme", "description": "Acme Corp", "tag_type": "customer"},
        {"id": "t2", "key": "team", "value": "marketing", "description": "Marketing", "tag_type": "team"},
    ]
    rows = [
        {"tag_id": "t1", "total_cost_usd": "20.0", "request_count": 10},
        {"tag_id": "t2", "total_cost_usd": "5.0", "request_count": 2},
    ]
    app = build_app(tags, rows)
    client = TestClient(app)
    r = client.get("/v1/attribution/summary?limit=1", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    assert data["items"][0]["tag"] == "customer:acme"
    assert len(data["items"]) == 1  # limit respected


def test_attribution_summary_averages():
    tags = [{"id": "t1", "key": "team", "value": "eng", "description": None, "tag_type": "team"}]
    rows = [{"tag_id": "t1", "total_cost_usd": "9.0", "request_count": 3}]
    app = build_app(tags, rows)
    client = TestClient(app)
    r = client.get("/v1/attribution/summary", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()
    item = data["items"][0]
    assert item["avg_cost_usd"] == 3.0

