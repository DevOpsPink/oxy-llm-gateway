from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.agent_templates import router as templates_router
from routes import agent_templates as templates_module


class FakeResponse:
    def __init__(self, data, status_code: int = 200):
        self._data = data
        self.status_code = status_code

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"status {self.status_code}")


class FakeHttpClient:
    def __init__(self, templates=None, org_guardrails=None):
        self.templates = templates or []
        self.sessions = []
        self.org_guardrails = org_guardrails or {"privacy_mode": "zero_prompt_logging", "dlp_mode": "block"}
        self.last_post = None

    async def get(self, url, params=None, headers=None, timeout=None):
        if "agent_templates" in url:
            template_id = None
            if params and params.get("id"):
                template_id = params["id"].split(".")[-1]
            rows = self.templates
            if template_id:
                rows = [t for t in rows if t["id"] == template_id]
            return FakeResponse(rows)
        if "organizations" in url:
            return FakeResponse([self.org_guardrails])
        return FakeResponse([])

    async def post(self, url, headers=None, json=None, timeout=None):
        if "agent_templates" in url:
            payload = {**json}
            payload.setdefault("id", f"tpl-{len(self.templates)+1}")
            self.templates.append(payload)
            return FakeResponse([payload])
        if "agent_sessions" in url:
            self.sessions.append(json)
            self.last_post = json
            return FakeResponse({"id": json.get("id"), **json})
        return FakeResponse({}, status_code=400)

    async def patch(self, url, params=None, headers=None, json=None, timeout=None):
        if "agent_templates" in url:
            template_id = params.get("id", "").split(".")[-1] if params and params.get("id") else None
            for t in self.templates:
                if t["id"] == template_id:
                    t.update(json or {})
                    return FakeResponse([t])
            return FakeResponse([], status_code=404)
        return FakeResponse({}, status_code=400)


def build_app(fake_http: FakeHttpClient):
    app = FastAPI()
    app.include_router(templates_router)

    # Patch dependency that extracts org/user
    templates_module.get_user_and_key_from_api_key = lambda: {
        "organization_id": "org-1",
        "project_id": "proj-1",
        "user_id": "user-1",
        "api_key": "oxy_live_test",
    }  # type: ignore

    # Swap http client to fake
    templates_module.resources.http_client = fake_http  # type: ignore
    return app


def test_create_template_merges_guardrails_stricter():
    fake_http = FakeHttpClient(org_guardrails={"privacy_mode": "zero_prompt_logging", "dlp_mode": "block", "allowed_models": ["gpt-4o", "claude-3"]})
    app = build_app(fake_http)
    client = TestClient(app)

    payload = {
        "name": "Security Agent",
        "model": "gpt-4o",
        "guardrail_config": {
            "privacy_mode": "debug_full",
            "dlp_mode": "log",
            "allowed_models": ["gpt-4o", "gpt-3.5-turbo"],
        },
    }
    resp = client.post("/v1/agent-templates", json=payload, headers={"Authorization": "Bearer oxy"})
    assert resp.status_code == 200
    created = resp.json()
    # org privacy/dlp should remain stricter
    assert created["guardrail_config"]["privacy_mode"] == "zero_prompt_logging"
    assert created["guardrail_config"]["dlp_mode"] == "block"
    # allowed_models intersect
    assert set(created["guardrail_config"]["allowed_models"]) == {"gpt-4o"}


def test_create_session_from_template_uses_template_defaults():
    template = {
        "id": "tpl-123",
        "organization_id": "org-1",
        "project_id": "proj-1",
        "name": "Support Bot",
        "model": "gpt-4o",
        "system_prompt": "be helpful",
        "tools": {"allow": ["search"]},
        "is_archived": False,
    }
    fake_http = FakeHttpClient(templates=[template])
    app = build_app(fake_http)
    client = TestClient(app)

    resp = client.post("/v1/agent-templates/tpl-123/sessions", json={"display_name": "Support Session", "metadata": {"priority": "p1"}}, headers={"Authorization": "Bearer oxy"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["template_id"] == "tpl-123"
    # Session payload stored by fake client reflects template defaults
    created_session = fake_http.sessions[-1]
    assert created_session["model"] == template["model"]
    assert created_session["system_prompt"] == template["system_prompt"]
    assert created_session["tools"] == template["tools"]
    assert created_session["display_name"] == "Support Session"
    assert created_session["metadata"]["priority"] == "p1"


def test_create_session_from_template_rejects_missing():
    fake_http = FakeHttpClient(templates=[])
    app = build_app(fake_http)
    client = TestClient(app)

    resp = client.post("/v1/agent-templates/does-not-exist/sessions", json={"display_name": "ghost"}, headers={"Authorization": "Bearer oxy"})
    assert resp.status_code == 404
    assert "Template not found" in resp.text


def test_archived_template_blocks_session():
    template = {
        "id": "tpl-archived",
        "organization_id": "org-1",
        "project_id": "proj-1",
        "name": "Old Template",
        "model": "gpt-4o",
        "is_archived": True,
    }
    fake_http = FakeHttpClient(templates=[template])
    app = build_app(fake_http)
    client = TestClient(app)

    resp = client.post("/v1/agent-templates/tpl-archived/sessions", json={}, headers={"Authorization": "Bearer oxy"})
    assert resp.status_code == 400
    assert "archived" in resp.text.lower()

