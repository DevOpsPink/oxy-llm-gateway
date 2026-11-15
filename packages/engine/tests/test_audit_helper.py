import asyncio

from core import audit


class FakeHttpClient:
    def __init__(self):
        self.calls = []

    async def post(self, url, headers=None, json=None):
        self.calls.append((url, json))
        return type("R", (), {"status_code": 201})


def test_log_admin_event_best_effort(monkeypatch):
    fake = FakeHttpClient()
    monkeypatch.setattr(audit.resources, "http_client", fake)
    monkeypatch.setattr(audit, "SUPABASE_URL", "http://supabase.test")
    monkeypatch.setattr(audit, "get_supabase_headers", lambda: {"api": "key"})

    asyncio.run(audit.log_admin_event("org-1", "guardrails.updated", metadata={"paused": True}))
    assert len(fake.calls) == 1
    assert fake.calls[0][0].endswith("/admin_audit_logs")

