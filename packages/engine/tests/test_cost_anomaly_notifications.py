import pytest
import httpx

from workers import cost_anomaly_detector


class DummyClient(httpx.AsyncClient):
    pass


@pytest.mark.asyncio
async def test_anomaly_alert_sends_slack_discord(monkeypatch):
    calls = []
    zap_calls = []

    async def fake_send(org_id, text):
        calls.append((org_id, text))

    async def fake_zapier(org_id, event_type, payload):
        zap_calls.append((org_id, event_type, payload))
        return True

    monkeypatch.setattr(cost_anomaly_detector, "send_slack_discord_alert", fake_send)
    monkeypatch.setattr(cost_anomaly_detector, "send_zapier_event", fake_zapier)

    anomaly = {
        "organization_id": "org-1",
        "project_name": "Demo",
        "current_spend_1h": "120.0",
        "baseline_hourly_spend": "20.0",
        "multiplier": 6.0,
        "severity": "WARNING",
    }

    async with DummyClient() as client:
        await cost_anomaly_detector.send_anomaly_alert(client, anomaly)

    assert calls, "Slack/Discord notifier should be invoked for anomalies"
    assert calls[0][0] == "org-1"
    assert "Cost Anomaly" in calls[0][1]
    assert zap_calls and zap_calls[0][1] == "anomaly.raised"
