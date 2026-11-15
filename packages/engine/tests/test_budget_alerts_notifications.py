import asyncio
from decimal import Decimal
from types import SimpleNamespace

import pytest

from workers import budget_alerts


class DummyTable:
    def __init__(self, data):
        self.data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def single(self):
        return self

    async def execute(self):
        return SimpleNamespace(data=self.data)


class DummySupabase:
    def __init__(self):
        self.profile_data = {"email": "user@example.com", "full_name": "User"}
        self.project_data = {"name": "Demo Project"}

    def table(self, name: str):
        if name == "profiles":
            return DummyTable(self.profile_data)
        if name == "projects":
            return DummyTable(self.project_data)
        return DummyTable({})


class DummyRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value
        return True


@pytest.mark.asyncio
async def test_budget_alert_sends_slack_discord_when_enabled(monkeypatch):
    calls = []
    zap_calls = []

    async def fake_send(org_id, text):
        calls.append((org_id, text))

    async def fake_zapier(org_id, event_type, payload):
        zap_calls.append((org_id, event_type, payload))
        return True

    # Patch resources
    monkeypatch.setattr(budget_alerts.resources, "supabase", DummySupabase())
    monkeypatch.setattr(budget_alerts.resources, "redis", DummyRedis())
    monkeypatch.setattr(budget_alerts, "send_slack_discord_alert", fake_send)
    monkeypatch.setattr(budget_alerts, "send_zapier_event", fake_zapier)

    # Avoid email path for faster test
    monkeypatch.setattr(budget_alerts, "EMAIL_ENABLED", False)

    await budget_alerts.send_budget_alert_if_needed(
        project_id="proj-1",
        user_id="user-1",
        threshold=95,
        current_spend=Decimal("95"),
        budget_limit=Decimal("100"),
        percentage=95.0,
        organization_id="org-1",
    )

    assert calls, "Slack/Discord notifier should be invoked when organization_id is present"
    assert calls[0][0] == "org-1"
    assert "Budget Alert" in calls[0][1]
    assert zap_calls and zap_calls[0][1] == "budget.threshold_crossed"
