from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests._roles import RoleAwareClient

from routes.team_v1 import router as team_router


def build_app(members, invites):
    app = FastAPI()
    app.include_router(team_router)

    async def fake_get_user_and_key():
        return {
            "organization_id": "org-1",
            "project_id": "proj-1",
            "user_id": "user-1",
            "budget_limit": 100,
            "api_key": "oxy_live_test",
        }

    from routes import team_v1 as t
    t.get_user_and_key_from_api_key = lambda: fake_get_user_and_key()  # type: ignore

    class FakeHttpClient:
        def __init__(self, members, invites):
            self.members = members
            self.invites = invites
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

            if "organization_members" in url:
                return Res(self.members)
            if "team_invites" in url:
                return Res(self.invites)
            return Res([])

        async def post(self, url, headers=None, json=None):
            self.last_post = json
            created = json | {"id": "invite-1", "created_at": "now()", "status": "pending"}
            return type("R", (), {"status_code": 201, "json": lambda: [created], "raise_for_status": lambda: None})

        async def patch(self, url, params=None, headers=None, json=None):
            self.last_patch = (params, json)
            updated = {"email": "a@b.com"}
            return type("R", (), {"status_code": 200, "json": lambda: [updated], "raise_for_status": lambda: None})

    # The caller owns the organization: require_org_admin lets organization settings change.
    t.resources.http_client = RoleAwareClient(FakeHttpClient(members, invites), "owner")  # type: ignore
    return app


def test_get_team():
    members = [
        {"id": "m1", "user_id": "u1", "role": "owner", "created_at": "t", "profiles": {"email": "a@b.com", "full_name": "A"}},
    ]
    invites = [{"id": "i1", "email": "x@y.com", "role": "member", "status": "pending"}]
    app = build_app(members, invites)
    client = TestClient(app)
    r = client.get("/v1/team", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert len(data["members"]) == 1
    assert len(data["invites"]) == 1


def test_create_invite():
    members = []
    invites = []
    app = build_app(members, invites)
    client = TestClient(app)
    r = client.post("/v1/team/invites", json={"email": "new@user.com", "role": "developer"}, headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "new@user.com"


def test_revoke_invite():
    members = []
    invites = []
    app = build_app(members, invites)
    client = TestClient(app)
    r = client.delete("/v1/team/invites/invite-1", headers={"Authorization": "Bearer oxy"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

