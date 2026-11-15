import pytest

from core import zapier


class DummyResponse:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code


@pytest.mark.asyncio
async def test_zapier_send_success(monkeypatch):
    calls = []

    async def fake_fetch(org_id):
        return {"zapier_enabled": True, "zapier_webhook_url": "https://hooks.zapier.com/hooks/catch/1/2", "zapier_events": ["budget.threshold_crossed"]}

    async def fake_post(url, payload):
        calls.append((url, payload))
        return DummyResponse(200)

    monkeypatch.setattr(zapier, "_fetch_settings", fake_fetch)
    ok = await zapier.send_zapier_event("org-1", "budget.threshold_crossed", {"project_id": "p1"}, post=fake_post)
    assert ok is True
    assert calls and calls[0][0].startswith("https://hooks.zapier.com/")
    assert calls[0][1]["event_type"] == "budget.threshold_crossed"


@pytest.mark.asyncio
async def test_zapier_retries_on_5xx(monkeypatch):
    calls = []

    async def fake_fetch(org_id):
        return {"zapier_enabled": True, "zapier_webhook_url": "https://hooks.zapier.com/hooks/catch/1/2", "zapier_events": ["anomaly.raised"]}

    async def fake_post(url, payload):
        calls.append((url, payload))
        if len(calls) == 1:
            return DummyResponse(503)
        return DummyResponse(200)

    monkeypatch.setattr(zapier, "_fetch_settings", fake_fetch)
    ok = await zapier.send_zapier_event("org-1", "anomaly.raised", {"severity": "high"}, post=fake_post)
    assert ok is True
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_zapier_not_sent_when_disabled(monkeypatch):
    calls = []

    async def fake_fetch(org_id):
        return {"zapier_enabled": False, "zapier_webhook_url": "https://hooks.zapier.com/hooks/catch/1/2", "zapier_events": ["budget.threshold_crossed"]}

    async def fake_post(url, payload):
        calls.append((url, payload))
        return DummyResponse(200)

    monkeypatch.setattr(zapier, "_fetch_settings", fake_fetch)
    ok = await zapier.send_zapier_event("org-1", "budget.threshold_crossed", {"project_id": "p1"}, post=fake_post)
    assert ok is False
    assert calls == []
