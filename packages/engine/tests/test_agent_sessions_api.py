from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.agent_sessions_v1 import router as sessions_router


def build_app(sessions, timeline=None):
    app = FastAPI()
    app.include_router(sessions_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import agent_sessions_v1 as s
    s.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, sessions, timeline):
            self.sessions = sessions
            self.timeline = timeline or []
            self.last_post = None
            self.posts = []
            self.calls = []

        async def get(self, url, params=None, headers=None):
            self.calls.append((url, params))
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data

            if "agent_sessions" in url:
                if params and params.get("id"):
                    return Res(self.sessions[:1])
                return Res(self.sessions)
            if "request_logs" in url:
                return Res(self.timeline)
            return Res([])

        async def post(self, url, headers=None, json=None):
            self.last_post = (url, json)
            self.posts.append(url)
            return type("R", (), {"status_code": 200, "json": lambda: True, "raise_for_status": lambda: None})

    s.resources.http_client = FakeHttpClient(sessions, timeline)  # type: ignore
    return app


def test_list_agent_sessions():
    sessions = [
        {"id": "s1", "status": "running", "session_type": "task", "metadata": {"model": "gpt-4"}, "total_cost": "0.1"},
    ]
    app = build_app(sessions)
    client = TestClient(app)
    r = client.get("/v1/agent-sessions", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["sessions"][0]["id"] == "s1"


SID = "5e55a7c3-0000-4000-8000-000000000001"


def test_get_agent_session_detail():
    sessions = [
        {"id": SID, "status": "running", "session_type": "task", "metadata": {"model": "gpt-4"}, "total_cost": "0.1"},
    ]
    timeline = [{"id": "r1", "model": "gpt-4"}]
    app = build_app(sessions, timeline)
    client = TestClient(app)
    r = client.get("/v1/agent-sessions/%s" % SID, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == SID
    assert "timeline" in data
    from routes import agent_sessions_v1 as s
    timeline_calls = [params for url, params in s.resources.http_client.calls if "request_logs" in url]
    assert timeline_calls and timeline_calls[0].get("session_id") == "eq.%s" % SID


def test_kill_agent_session():
    sessions = [
        {"id": SID, "status": "running", "session_type": "task", "metadata": {"model": "gpt-4"}, "total_cost": "0.1"},
    ]
    app = build_app(sessions)
    client = TestClient(app)
    r = client.post("/v1/agent-sessions/%s/kill" % SID, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    from routes import agent_sessions_v1 as s
    owned = [params for url, params in s.resources.http_client.calls if "agent_sessions" in url]
    assert owned and owned[0].get("organization_id") == "eq.org-1", "ownership is checked against the key's organization"
    assert any(u.endswith("/rpc/fn_kill_agent_session") for u in s.resources.http_client.posts)


def test_kill_of_another_organizations_session_is_refused():
    app = build_app([])  # the key's organization owns no such session
    client = TestClient(app)
    r = client.post("/v1/agent-sessions/%s/kill" % SID, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 404
    from routes import agent_sessions_v1 as s
    assert s.resources.http_client.last_post is None, "no kill was attempted"
