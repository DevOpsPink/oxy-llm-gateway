from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests._roles import RoleAwareClient

from routes.notifications_v1 import router as notif_router, ALLOWED_EVENTS


def build_app(settings=None, webhooks=None):
    app = FastAPI()
    app.include_router(notif_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import notifications_v1 as n
    n.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, settings, webhooks):
            self.settings = settings or []
            self.webhooks = webhooks or []
            self.last_post = None
            self.last_patch = None

        async def get(self, url, params=None, headers=None):
            class Res:
                def __init__(self, data):
                    self._data = data
                    self.status_code = 200

                def raise_for_status(self):
                    return

                def json(self):
                    return self._data
            if "notification_settings" in url:
                return Res(self.settings)
            if "webhooks" in url:
                return Res(self.webhooks)
            return Res([])

        async def post(self, url, params=None, headers=None, json=None):
            if "webhooks" in url:
                created = (json or {}) | {"id": "wh_1"}
                return type("R", (), {"status_code": 201, "json": lambda: [created], "raise_for_status": lambda: None})
            created = (json or {}) | {"id": "set_1"}
            return type("R", (), {"status_code": 201, "json": lambda: [created], "raise_for_status": lambda: None})

        async def patch(self, url, params=None, headers=None, json=None):
            self.last_patch = (params, json)
            return type("R", (), {"status_code": 200, "json": lambda: [{"id": "wh_1"}], "raise_for_status": lambda: None})

    # The caller owns the organization: require_org_admin lets organization settings change.
    n.resources.http_client = RoleAwareClient(FakeHttpClient(settings, webhooks), "owner")  # type: ignore
    return app


def test_get_notification_settings_defaults():
    app = build_app(settings=[])
    client = TestClient(app)
    r = client.get("/v1/notifications/settings", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert "budget_email_enabled" in data


def test_update_notification_settings():
    app = build_app(settings=[])
    client = TestClient(app)
    payload = {
        "alerts_email": "a@b.com",
        "budget_email_enabled": False,
        "slack_enabled": True,
        "slack_webhook_url": "https://hooks.slack.com/services/T000/B000/XXX",
        "discord_enabled": True,
        "discord_webhook_url": "https://discord.com/api/webhooks/123/abc",
        "zapier_enabled": True,
        "zapier_webhook_url": "https://hooks.zapier.com/hooks/catch/1/2",
        "zapier_events": ["budget.threshold_crossed", "anomaly.raised"],
    }
    r = client.post("/v1/notifications/settings", json=payload, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["alerts_email"] == "a@b.com"
    assert data["slack_webhook_url"].startswith("https://hooks.slack.com/")
    assert data["discord_webhook_url"].startswith("https://discord.com/api/webhooks/")
    assert data["zapier_webhook_url"].startswith("https://hooks.zapier.com/")


def test_update_notification_settings_invalid_slack():
    app = build_app(settings=[])
    client = TestClient(app)
    r = client.post(
        "/v1/notifications/settings",
        json={"slack_enabled": True, "slack_webhook_url": "https://example.com/not-slack"},
        headers={"Authorization": "Bearer oxy"},
    )
    assert r.status_code == 400
    assert "Slack webhook URL" in r.json().get("detail", "")


def test_update_notification_settings_invalid_discord():
    app = build_app(settings=[])
    client = TestClient(app)
    r = client.post(
        "/v1/notifications/settings",
        json={"discord_enabled": True, "discord_webhook_url": "https://example.com/not-discord"},
        headers={"Authorization": "Bearer oxy"},
    )
    assert r.status_code == 400
    assert "Discord webhook URL" in r.json().get("detail", "")


def test_update_notification_settings_invalid_zapier():
    app = build_app(settings=[])
    client = TestClient(app)
    r = client.post(
        "/v1/notifications/settings",
        json={"zapier_enabled": True, "zapier_webhook_url": "https://example.com/not-zapier"},
        headers={"Authorization": "Bearer oxy"},
    )
    assert r.status_code == 400
    assert "Zapier webhook URL" in r.json().get("detail", "")


def test_webhook_crud():
    app = build_app(settings=[], webhooks=[])
    client = TestClient(app)
    r = client.get("/v1/webhooks", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    assert r.json()["webhooks"] == []

    r = client.post("/v1/webhooks", json={"url": "https://example.com/hook", "event_types": list(ALLOWED_EVENTS)[:1]}, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["url"].startswith("https://")

    r = client.delete("/v1/webhooks/wh_1", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

