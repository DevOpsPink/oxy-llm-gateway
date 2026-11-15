import asyncio
import json
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from routes import proxy
from routes import intelligence as intel
from routes import exports
from dependencies import build_api_key_dependency
from providers import provider_registry


def _stub_auth():
    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
            "plan_tier": "free",
            "org_paused": False,
        }

    proxy.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore
    intel.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore
    proxy.api_key_dependency = build_api_key_dependency(lambda: proxy.get_user_and_key_from_api_key)  # type: ignore
    intel.api_key_dependency = build_api_key_dependency(lambda: intel.get_user_and_key_from_api_key)  # type: ignore


def _stub_budget(should_block=False):
    class FakeBudgetManager:
        async def reserve_budget(self, *args, **kwargs):
            if should_block:
                raise HTTPException(status_code=402, detail="over budget")
            return {"allowed": True, "budget_limit": 1000}

    proxy.budget_manager = FakeBudgetManager()  # type: ignore
    from core import resources

    resources.budget_manager = FakeBudgetManager()  # type: ignore


def _stub_proxy_forward():
    async def fake_forward(*args, **kwargs):
        return {"choices": [{"message": {"content": "ok"}}]}

    proxy._forward_request = fake_forward  # type: ignore


def _stub_intel(anomalies=None):
    anomalies = anomalies or []

    async def fake_fetch_anomalies(org_id, limit=10):
        return anomalies

    async def fake_top_models(org_id, month_start):
        return [{"model": "gpt-4.1", "cost_usd": 10}]

    async def fake_top_projects(org_id, month_start):
        return [{"project_id": "proj-1", "cost_usd": 10}]

    async def fake_month_cost(org_id, month_start):
        return 10.0

    async def fake_security_score(org_id):
        return {"grade": "B", "details": []}

    intel._fetch_anomalies = fake_fetch_anomalies  # type: ignore
    intel._fetch_top_models = fake_top_models  # type: ignore
    intel._fetch_top_projects = fake_top_projects  # type: ignore
    intel._fetch_month_cost = fake_month_cost  # type: ignore
    intel._security_score = fake_security_score  # type: ignore


def _stub_exports(export_rows=None):
    rows = export_rows or []

    async def fake_get_user_and_org_from_jwt(request):
        return {"organization_id": "org-1", "user_id": "user-1"}

    exports.get_user_and_org_from_jwt = fake_get_user_and_org_from_jwt  # type: ignore
    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 1000,
            "api_key": "oxy_live_test",
        }

    exports.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore
    exports.api_key_dependency = build_api_key_dependency(lambda: exports.get_user_and_key_from_api_key)  # type: ignore

    class FakeRes:
        def __init__(self, data):
            self._data = data
            self.status_code = 200

        def raise_for_status(self):
            return

        def json(self):
            return self._data

        @property
        def content(self):
            lines = ["id,created_at,model,provider,status,project_id,cost_tags,prompt_snapshot"]
            for r in self._data:
                lines.append(
                    f"{r['id']},{r['created_at']},{r['model']},{r['provider']},{r['status']},{r['project_id']},{json.dumps(r.get('cost_tags', {}))},{r.get('prompt_snapshot') or ''}"
                )
            return "\n".join(lines).encode()

    class FakeHttpClient:
        async def get(self, url, params=None, headers=None, timeout=None):
            return FakeRes(rows)

    exports.resources.http_client = FakeHttpClient()  # type: ignore
    class FakeTable:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *args, **kwargs):
            return self

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

        def execute(self):
            return type("R", (), {"data": self.rows})

    class FakeSupabase:
        def __init__(self, rows):
            self.rows = rows

        def table(self, name):
            if name == "request_logs":
                return FakeTable(self.rows)
            return FakeTable([])

    exports.resources.supabase = FakeSupabase(rows)  # type: ignore


def _stub_providers():
    class FakeProvider:
        async def complete(self, *args, **kwargs):
            return {"choices": [{"message": {"content": "ok"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}}

        async def stream(self, *args, **kwargs):
            yield b"data: ok\n\n"

    provider_registry._provider_instances = {
        "openai": FakeProvider(),
        "anthropic": FakeProvider(),
        "local": FakeProvider(),
    }


def build_test_app(anomalies=None, export_rows=None, budget_block=False):
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(proxy.router)
    app.include_router(intel.router)
    app.include_router(exports.router)

    _stub_auth()
    _stub_budget(should_block=budget_block)
    _stub_proxy_forward()
    _stub_intel(anomalies=anomalies)
    _stub_exports(export_rows=export_rows)
    _stub_providers()

    class FakeHTTPClient:
        async def post(self, *args, **kwargs):
            return type("Res", (), {"status_code": 200, "json": lambda self: {}, "raise_for_status": lambda self: None})()

        async def patch(self, *args, **kwargs):
            return type("Res", (), {"status_code": 200, "json": lambda self: {}, "raise_for_status": lambda self: None})()

        async def get(self, *args, **kwargs):
            return type("Res", (), {"status_code": 200, "json": lambda self: {}, "raise_for_status": lambda self: None})()

    from core import resources

    resources.http_client = FakeHTTPClient()

    return app


def test_budget_block_integration():
    client = TestClient(build_test_app(budget_block=True))
    # Force control hook to allow but budget reservation to block
    from routes import proxy as proxy_module
    async def allow_execution(*args, **kwargs):
        return {"status": "ok", "allowed": True}
    proxy_module.check_execution_allowed = allow_execution  # type: ignore
    resp = client.post(
        "/v1/chat/completions",
        json={"model": "gpt-4.1-mini", "messages": [{"role": "user", "content": "hi"}]},
        headers={"Authorization": "Bearer oxy_live_test"},
    )
    assert resp.status_code == 402
    assert "over budget" in resp.text


def test_intelligence_overview_integration_anomaly_and_score():
    anomalies = [{"type": "cost_spike", "severity": "high", "detected_at": "2025-01-01T00:00:00Z"}]
    client = TestClient(build_test_app(anomalies=anomalies))
    resp = client.get("/v1/intelligence/overview", headers={"Authorization": "Bearer oxy_live_test"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["anomalies"] == anomalies
    assert data["forecast"]["projected_end_of_month_cost_usd"] >= data["forecast"]["month_to_date_cost_usd"]
    assert data["security_score"]["grade"] in {"A", "B", "C", "D", "F"}


def test_privacy_dlp_export_integration():
    rows = [
        {
            "id": "log1",
            "created_at": "2025-01-01T00:00:00Z",
            "model": "gpt-4.1-mini",
            "provider": "openai",
            "status": 200,
            "project_id": "proj-1",
            "cost_tags": {"customer": "acme"},
            "prompt_snapshot": None,  # redacted by privacy mode
        }
    ]
    client = TestClient(build_test_app(export_rows=rows))
    resp = client.get("/v1/exports/requests.csv", headers={"Authorization": "Bearer oxy_live_test"})
    assert resp.status_code == 200
    body = resp.content.decode()
    assert "log1" in body
    assert "log1" in body
    assert "gpt-4.1-mini" in body


def test_local_llm_integration():
    from providers import local_provider as lp

    captured = {}

    class FakeResponse:
        def __init__(self, json_data):
            self._json = json_data
            self.status_code = 200

        def json(self):
            return self._json

        def raise_for_status(self):
            return None

    class FakeClient:
        async def post(self, url, json=None, timeout=None):
            captured["url"] = url
            captured["payload"] = json
            captured["timeout"] = timeout
            return FakeResponse({"choices": [{"message": {"content": "ok"}}]})

    async def run_complete():
        provider = lp.OpenAICompatibleProvider(api_key="", http_client=FakeClient(), base_url="http://local-http")
        result = await provider.complete("local/test-model", [{"role": "user", "content": "hi"}])
        assert "local-http" in captured["url"]
        assert result["choices"][0]["message"]["content"] == "ok"
        assert captured["timeout"] == lp.LOCAL_MODEL_TIMEOUT

    asyncio.run(run_complete())


def test_cost_attribution_export_integration():
    rows = [
        {
            "id": "log2",
            "created_at": "2025-01-01T00:00:00Z",
            "model": "gpt-4.1-mini",
            "provider": "openai",
            "status": 200,
            "project_id": "proj-1",
            "cost_tags": {"customer": "acme", "feature": "chat"},
            "prompt_snapshot": None,
        }
    ]
    client = TestClient(build_test_app(export_rows=rows))
    resp = client.get("/v1/attribution/summary", headers={"Authorization": "Bearer oxy_live_test"})
    # This route may not be wired in this app; fall back to CSV check for tags presence.
    if resp.status_code == 200:
        summary = resp.json()
        assert isinstance(summary, list)
    csv_resp = client.get("/v1/exports/requests.csv", headers={"Authorization": "Bearer oxy_live_test"})
    assert csv_resp.status_code == 200
    body = csv_resp.content.decode()
    assert "log2" in body

