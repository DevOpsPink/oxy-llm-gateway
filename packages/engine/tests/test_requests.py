from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace

from routes.requests import router as requests_router


class FakeQuery:
    def __init__(self, data):
        self._data = data
        self.filters = {}
        self._limit = None
        self._order_desc = False

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def order(self, _field, desc=False):
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        items = self._data
        # Apply filters (simple equality)
        for field, value in self.filters.items():
            items = [i for i in items if i.get(field) == value]
        # Order
        if self._order_desc:
            items = sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)
        # Limit
        if self._limit is not None:
            items = items[: self._limit]
        return SimpleNamespace(data=items)


def build_app(fake_data):
    app = FastAPI()
    app.include_router(requests_router)

    # Dependency override for API key auth
    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
        }

    # Patch dependencies
    from routes import requests as req_module
    req_module.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    # Patch supabase table
    class FakeSupabase:
        def __init__(self, data):
            self._data = data

        def table(self, _name):
            return FakeQuery(self._data)

    req_module.resources.supabase = FakeSupabase(fake_data)  # type: ignore

    return app


def test_requests_endpoint_filters_and_limits():
    fake_logs = [
        {
            "id": "1",
            "organization_id": "org-1",
            "model": "gpt-4",
            "provider": "openai",
            "status": "success",
            "created_at": "2025-01-02T10:00:00Z",
            "latency_ms": 120,
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
            "cost_usd": 0.01,
        },
        {
            "id": "2",
            "organization_id": "org-1",
            "model": "claude-3",
            "provider": "anthropic",
            "status": "error",
            "created_at": "2025-01-03T10:00:00Z",
            "latency_ms": 200,
            "prompt_tokens": 5,
            "completion_tokens": 0,
            "total_tokens": 5,
            "cost_usd": 0.0,
        },
    ]

    app = build_app(fake_logs)
    client = TestClient(app)

    # No filters -> returns both, ordered desc by created_at
    res = client.get("/v1/requests")
    assert res.status_code == 200
    items = res.json()["items"]
    assert [i["id"] for i in items] == ["2", "1"]

    # Filter by provider
    res = client.get("/v1/requests", params={"provider": "openai"})
    items = res.json()["items"]
    assert len(items) == 1 and items[0]["provider"] == "openai"

    # Limit
    res = client.get("/v1/requests", params={"limit": 1})
    items = res.json()["items"]
    assert len(items) == 1

