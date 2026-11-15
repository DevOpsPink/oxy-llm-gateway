from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.exports import router as exports_router


def build_app(fake_rows):
    app = FastAPI()
    app.include_router(exports_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import exports as exp
    exp.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeQuery:
        def __init__(self, rows):
            self.rows = rows

        def eq(self, *args, **kwargs):
            return self

        def gte(self, *args, **kwargs):
            return self

        def lte(self, *args, **kwargs):
            return self

        def order(self, *args, **kwargs):
            return self

        def limit(self, *args, **kwargs):
            return self

        async def execute(self):  # the route awaits it, as the real client's
            return type("R", (), {"data": self.rows})

    class FakeTable:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *_fields):
            return FakeQuery(self.rows)

    class FakeSupabase:
        def __init__(self, rows):
            self.rows = rows

        def table(self, name):
            if name == "request_logs":
                return FakeTable(self.rows)
            raise ValueError("unexpected table")

    exp.resources.supabase = FakeSupabase(fake_rows)  # type: ignore
    return app


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _restore_resources():
    from core import resources
    saved = (resources.supabase, resources.http_client)
    yield
    resources.supabase, resources.http_client = saved


def test_exports_csv_basic_headers_and_rows():
    rows = [
        {
            "id": "r1",
            "created_at": "2025-01-01T00:00:00Z",
            "provider": "openai",
            "model": "gpt-4.1-mini",
            "status": "200",
            "latency_ms": 123,
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "cost_usd": "0.0025",
            "project_id": "proj-1",
            "privacy_mode": "metadata_only",
            "prompt_snapshot": None,
            "response_snapshot": None,
        }
    ]
    app = build_app(rows)
    client = TestClient(app)

    r = client.get("/v1/exports/requests.csv", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert ".csv" in r.headers.get("content-disposition", "")
    body = r.text.strip().splitlines()
    assert body[0].startswith("id,created_at,provider")
    assert "gpt-4.1-mini" in body[1]
    # Ensure snapshots are not included in CSV when metadata_only
    assert "prompt_snapshot" not in body[0]


def test_exports_csv_filters_and_limit():
    rows = []
    app = build_app(rows)
    client = TestClient(app)
    r = client.get(
        "/v1/exports/requests.csv?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z&limit=5&model=gpt-4",
        headers={"Authorization": "Bearer oxy_live_test"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")

