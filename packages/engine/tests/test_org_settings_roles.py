"""Organization settings change only by an owner or admin.

The dashboard reaches the /v1 settings routes with any active member's session,
and an Oxy API key acts as the member who created it. A developer reads these
settings but must not change privacy, guardrails, providers, the organization,
notifications, webhooks or invitations. require_org_admin runs first in every
handler that changes them, so a refused caller touches nothing.
"""
import importlib

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from core import resources
from dependencies import require_org_admin
from tests._roles import RoleAwareClient

KEY = {
    "organization_id": "org-1",
    "project_id": "proj-1",
    "user_id": "user-1",
    "budget_limit": 100,
    "api_key": "oxy_live_test",
}

# Every handler that changes organization-wide settings, with a body it accepts.
WRITES = [
    ("routes.privacy", "POST", "/v1/privacy", {"privacy_mode": "zero_prompt_logging"}),
    ("routes.guardrails", "POST", "/v1/guardrails", {"paused": True}),
    ("routes.providers_v1", "POST", "/v1/providers/config", {"google": {"enabled": True}}),
    ("routes.org_v1", "POST", "/v1/org", {"slug": "oxy-new"}),
    ("routes.notifications_v1", "POST", "/v1/notifications/settings", {"alerts_email": "a@b.com"}),
    ("routes.notifications_v1", "POST", "/v1/webhooks",
     {"url": "https://example.com/hook", "event_types": ["budget.threshold_crossed"]}),
    ("routes.notifications_v1", "DELETE", "/v1/webhooks/wh_1", None),
    ("routes.team_v1", "POST", "/v1/team/invites", {"email": "new@user.com", "role": "developer"}),
    ("routes.team_v1", "DELETE", "/v1/team/invites/invite-1", None),
]


class Untouchable:
    """A database the handler must not reach: records every use."""

    def __init__(self):
        self.touched = []

    def __getattr__(self, name):
        def use(*args, **kwargs):
            self.touched.append(name)
            raise AssertionError("the handler reached the database: %s" % name)
        return use


@pytest.mark.parametrize("module, method, path, body", WRITES, ids=[w[1] + " " + w[2] for w in WRITES])
@pytest.mark.parametrize("role", ["developer", "viewer", None], ids=["developer", "viewer", "no-membership"])
def test_settings_change_refused_below_admin(monkeypatch, module, method, path, body, role):
    mod = importlib.import_module(module)

    async def caller():
        return dict(KEY)

    monkeypatch.setattr(mod, "get_user_and_key_from_api_key", lambda: caller())
    db = Untouchable()
    client_db = RoleAwareClient(db, role)
    monkeypatch.setattr(resources, "http_client", client_db)
    monkeypatch.setattr(resources, "supabase", db)

    app = FastAPI()
    app.include_router(mod.router)
    r = TestClient(app).request(method, path, json=body, headers={"Authorization": "Bearer oxy_live_test"})

    assert r.status_code == 403, r.text
    assert db.touched == []
    assert client_db.lookups == [{"select": "role", "user_id": "eq.user-1", "organization_id": "eq.org-1",
                                  "status": "eq.active", "limit": "1"}]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["owner", "admin"])
async def test_owner_and_admin_may_change_settings(monkeypatch, role):
    monkeypatch.setattr(resources, "http_client", RoleAwareClient(None, role))
    await require_org_admin(dict(KEY))


@pytest.mark.asyncio
async def test_role_lookup_failure_refuses_the_change(monkeypatch):
    monkeypatch.setattr(resources, "http_client", RoleAwareClient(None, "error"))
    with pytest.raises(HTTPException) as e:
        await require_org_admin(dict(KEY))
    assert e.value.status_code == 503
