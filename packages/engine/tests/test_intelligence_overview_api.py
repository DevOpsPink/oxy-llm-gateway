from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.intelligence import router as intelligence_router


def build_app():
    app = FastAPI()
    app.include_router(intelligence_router)

    # Stub auth dependency (API key)
    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import intelligence as intel
    intel.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    # Stub helper functions to avoid network calls
    async def fake_anomalies(_org_id: str, limit: int = 10):
        return [
            {
                "id": "a1",
                "type": "cost_spike",
                "severity": "critical",
                "detected_at": "2025-01-01T00:00:00Z",
                "description": "Cost spike detected",
                "project_id": "proj-1",
                "model": "gpt-4.1-mini",
                "estimated_impact_usd": 12.34,
            }
        ]

    async def fake_models(_org_id: str, _month_start, limit: int = 5):
        return [
            {"model": "gpt-4.1-mini", "requests": 10, "cost_usd": 20.0},
            {"model": "gpt-4o-mini", "requests": 5, "cost_usd": 5.0},
        ]

    async def fake_projects(_org_id: str, _month_start, limit: int = 5):
        return [
            {"project_id": "proj-1", "name": "Project One", "cost_usd": 15.0, "requests": 8},
            {"project_id": "proj-2", "name": "Project Two", "cost_usd": 10.0, "requests": 4},
        ]

    async def fake_month_cost(_org_id: str, _month_start):
        return 25.0

    async def fake_security(_org_id: str):
        return {
            "grade": "B",
            "details": [
                {"key": "guardrails_enabled", "label": "Guardrails enabled", "status": "ok"},
                {"key": "dlp_enabled", "label": "DLP scanning", "status": "ok"},
            ],
        }

    intel._fetch_anomalies = fake_anomalies  # type: ignore
    intel._fetch_top_models = fake_models  # type: ignore
    intel._fetch_top_projects = fake_projects  # type: ignore
    intel._fetch_month_cost = fake_month_cost  # type: ignore
    intel._security_score = fake_security  # type: ignore

    return app


def test_intelligence_overview_payload():
    app = build_app()
    client = TestClient(app)

    r = client.get("/v1/intelligence/overview", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    data = r.json()

    assert data["anomalies"][0]["type"] == "cost_spike"
    assert data["anomalies"][0]["severity"] == "critical"

    # Top models sorted by cost desc (from stub)
    assert data["cost_insights"]["top_models"][0]["cost_usd"] >= data["cost_insights"]["top_models"][1]["cost_usd"]

    # Forecast should be >= month to date
    assert data["forecast"]["projected_end_of_month_cost_usd"] >= data["forecast"]["month_to_date_cost_usd"]

    assert data["security_score"]["grade"] == "B"


def test_intelligence_overview_integration_shape():
    """Integration-style check: seeded data returns safe, structured overview."""
    app = build_app()
    client = TestClient(app)

    resp = client.get("/v1/intelligence/overview", headers={"Authorization": "Bearer oxy_live_test"})
    assert resp.status_code == 200
    payload = resp.json()

    assert isinstance(payload["anomalies"], list) and payload["anomalies"]
    assert "cost_insights" in payload and "forecast" in payload
    assert payload["forecast"]["projected_end_of_month_cost_usd"] >= payload["forecast"]["month_to_date_cost_usd"]
    assert "security_score" in payload and payload["security_score"]["grade"]


def test_intelligence_overview_no_anomalies_returns_empty_list():
    app = build_app()

    from routes import intelligence as intel
    intel._fetch_anomalies = lambda _org_id, limit=10: []  # type: ignore

    client = TestClient(app)
    resp = client.get("/v1/intelligence/overview", headers={"Authorization": "Bearer oxy_live_test"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["anomalies"] == []


def test_intelligence_overview_spike_yields_anomaly():
    app = build_app()

    from routes import intelligence as intel
    intel._fetch_anomalies = lambda _org_id, limit=10: [
        {
            "id": "spike-1",
            "type": "cost_spike",
            "severity": "high",
            "detected_at": "2025-02-02T00:00:00Z",
            "description": "Cost spike vs baseline",
            "project_id": "proj-1",
            "model": "gpt-4.1",
            "estimated_impact_usd": 42.0,
        }
    ]  # type: ignore

    client = TestClient(app)
    resp = client.get("/v1/intelligence/overview", headers={"Authorization": "Bearer oxy_live_test"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["anomalies"]
    assert payload["anomalies"][0]["type"] == "cost_spike"


def test_intelligence_overview_minimal_data_is_safe():
    app = build_app()

    from routes import intelligence as intel
    intel._fetch_anomalies = lambda _org_id, limit=10: []  # type: ignore
    intel._fetch_top_models = lambda _org_id, _month_start, limit=5: []  # type: ignore
    intel._fetch_top_projects = lambda _org_id, _month_start, limit=5: []  # type: ignore
    intel._fetch_month_cost = lambda _org_id, _month_start: 0.0  # type: ignore

    client = TestClient(app)
    resp = client.get("/v1/intelligence/overview", headers={"Authorization": "Bearer oxy_live_test"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["anomalies"] == []
    assert payload["cost_insights"]["top_models"] == []
    assert payload["cost_insights"]["top_projects"] == []
    assert payload["forecast"]["projected_end_of_month_cost_usd"] >= payload["forecast"]["month_to_date_cost_usd"]
