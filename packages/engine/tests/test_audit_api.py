from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.audit import router as audit_router


def build_app(events):
    app = FastAPI()
    app.include_router(audit_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import audit as a
    a.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, events):
            self.events = events

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data

            return Res(self.events)

    a.resources.http_client = FakeHttpClient(events)  # type: ignore
    return app


def test_audit_list_limit():
    events = [{"id": "1", "event_type": "guardrails.updated", "organization_id": "org-1"}]
    app = build_app(events)
    client = TestClient(app)
    r = client.get("/v1/audit/logs?limit=5", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    assert "events" in r.json()


def test_audit_filter_event_type():
    events = [{"id": "1", "event_type": "privacy.updated", "organization_id": "org-1"}]
    app = build_app(events)
    client = TestClient(app)
    r = client.get("/v1/audit/logs?event_type=privacy.updated", headers={"Authorization": "Bearer oxy_live_test"})
    assert r.status_code == 200
    body = r.json()
    assert body["events"][0]["event_type"] == "privacy.updated"

