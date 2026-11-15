"""The dashboard's project and provider-key routes, against the tables they write.

v1.0.1 called fn_create_project, fn_update_project, fn_delete_project and
fn_disconnect_provider, which the schema never had: every one answered 500,
so the dashboard could not set a budget. These tests pin the table writes that
replace them, who may make them, and that deleting a project keeps its audit
trail (request_logs cascade on a real DELETE).
"""
import pytest
from fastapi.testclient import TestClient

CSRF = {"X-CSRF-Token": "t"}
COOKIES = {"csrf_token": "t"}


class Res:
    def __init__(self, data=None, status_code=200, headers=None):
        self._data = data
        self.status_code = status_code
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP %d" % self.status_code)

    def json(self):
        return self._data


class Database:
    """Answers the reads these routes make and records every write."""

    def __init__(self, project_found=True, role="owner"):
        self.project_found = project_found
        self.role = role
        self.calls = []  # (method, table, params, json)

    def _table(self, url):
        return url.rsplit("/rest/v1/", 1)[-1]

    async def get(self, url, params=None, headers=None, **kwargs):
        table = self._table(url)
        self.calls.append(("GET", table, params or {}, None))
        if table == "projects" and (params or {}).get("select") == "organization_id":
            return Res([{"organization_id": "org-1"}] if self.project_found else [])
        if table == "projects" and (params or {}).get("select") == "id":
            return Res([], headers={"Content-Range": "*/0"})
        if table == "organization_members" and (params or {}).get("select") == "role":
            return Res([] if self.role is None else [{"role": self.role}])
        if table == "organizations":
            return Res([{"id": "org-1"}])
        return Res([])

    async def post(self, url, headers=None, json=None, **kwargs):
        table = self._table(url)
        self.calls.append(("POST", table, {}, json))
        if table == "projects":
            return Res([{"id": "proj-2", "name": json["name"], "budget_limit": "0.00"}], 201)
        return Res([], 201)

    async def patch(self, url, params=None, headers=None, json=None, **kwargs):
        table = self._table(url)
        self.calls.append(("PATCH", table, params or {}, json))
        return Res([{"id": "proj-1"}])

    async def delete(self, url, *args, **kwargs):
        self.calls.append(("DELETE", self._table(url), kwargs.get("params") or {}, None))
        return Res([])

    def writes(self):
        return [c for c in self.calls if c[0] != "GET"]


@pytest.fixture
def stack(monkeypatch):
    import main
    from core import resources
    from dependencies import get_current_user_id

    def build(project_found=True, role="owner", admin=True):
        db = Database(project_found=project_found, role=role)
        order = []
        monkeypatch.setattr(resources, "http_client", db)
        monkeypatch.setattr(main.limiter, "enabled", False)

        async def permission(user_id, organization_id, required_role="developer"):
            return admin

        async def orgs(user_id):
            return [{"organization_id": "org-1"}]

        async def add_ons(organization_id):
            return set()

        async def cleared(project_id):
            order.append(("cleared", project_id, len(db.writes())))

        monkeypatch.setattr(main, "check_organization_permission", permission)
        monkeypatch.setattr(main, "get_user_organizations", orgs)
        monkeypatch.setattr(main, "get_org_add_ons", add_ons)
        monkeypatch.setattr(main, "clear_project_cache", cleared)
        main.app.dependency_overrides[get_current_user_id] = lambda: "user-1"
        client = TestClient(main.app, base_url="http://localhost", raise_server_exceptions=False)
        client.cookies.update(COOKIES)
        return client, db, order

    yield build
    main.app.dependency_overrides.clear()


def test_setting_a_budget_writes_the_project_and_drops_its_cached_keys(stack):
    client, db, order = stack()
    r = client.put("/management/project/proj-1", json={"name": "Agents", "budget_limit": "12.50"}, headers=CSRF)
    assert r.status_code == 200, r.text
    assert db.writes() == [("PATCH", "projects",
                            {"id": "eq.proj-1", "organization_id": "eq.org-1", "status": "neq.deleted"},
                            {"name": "Agents", "budget_limit": "12.50", "updated_at": db.writes()[0][3]["updated_at"]})]
    assert order == [("cleared", "proj-1", 1)]  # after the write, not before
    assert not any("rpc/" in c[1] for c in db.calls)


def test_a_deleted_or_missing_project_is_not_found(stack):
    client, db, order = stack(project_found=False)
    assert client.put("/management/project/gone", json={"name": "x", "budget_limit": "1"}, headers=CSRF).status_code == 404
    assert client.delete("/management/project/gone", headers=CSRF).status_code == 404
    assert db.writes() == [] and order == []
    lookups = [c[2] for c in db.calls if c[1] == "projects"]
    assert lookups and all(p.get("status") == "neq.deleted" for p in lookups)


def test_deleting_a_project_stops_its_keys_and_keeps_its_audit_trail(stack):
    client, db, order = stack()
    r = client.delete("/management/project/proj-1", headers=CSRF)
    assert r.status_code == 200, r.text
    writes = db.writes()
    assert [(w[0], w[1]) for w in writes] == [("PATCH", "api_keys"), ("PATCH", "projects")]
    assert writes[0][2] == {"project_id": "eq.proj-1"} and writes[0][3] == {"is_active": False}
    assert writes[1][2] == {"id": "eq.proj-1", "organization_id": "eq.org-1"}
    assert writes[1][3]["status"] == "deleted"
    assert not any(w[0] == "DELETE" for w in db.calls)  # a DELETE would cascade to request_logs
    assert order == [("cleared", "proj-1", 2)]  # the cache is dropped after both writes


def test_creating_a_project_inserts_a_row_without_a_cap(stack):
    client, db, order = stack()
    r = client.post("/management/project", json={"name": "Second"}, headers=CSRF)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == "proj-2"
    assert db.writes() == [("POST", "projects", {}, {"organization_id": "org-1", "user_id": "user-1", "name": "Second"})]
    count = [c for c in db.calls if c[1] == "projects" and c[2].get("select") == "id"]
    assert count and count[0][2].get("status") == "neq.deleted"  # deleted projects do not count toward the cap


@pytest.mark.parametrize("call", [
    lambda c: c.put("/management/project/proj-1", json={"name": "x", "budget_limit": "1"}, headers=CSRF),
    lambda c: c.delete("/management/project/proj-1", headers=CSRF),
    lambda c: c.post("/management/project", json={"name": "x"}, headers=CSRF),
], ids=["update", "delete", "create"])
def test_a_developer_cannot_change_projects(stack, call):
    client, db, order = stack(admin=False)
    assert call(client).status_code == 403
    assert db.writes() == [] and order == []


def test_disconnecting_providers_marks_the_organizations_keys_inactive(stack):
    client, db, order = stack(role="owner")
    r = client.delete("/management/provider", headers=CSRF)
    assert r.status_code == 200, r.text
    writes = db.writes()
    assert [(w[0], w[1]) for w in writes] == [("PATCH", "providers")]
    assert writes[0][2] == {"organization_id": "eq.org-1", "is_active": "eq.true"}
    assert writes[0][3]["is_active"] is False


@pytest.mark.parametrize("role", ["developer", "viewer", None])
def test_only_an_owner_or_admin_touches_provider_keys(stack, role):
    client, db, order = stack(role=role)
    assert client.delete("/management/provider", headers=CSRF).status_code == 403
    r = client.post("/management/provider", json={"provider_name": "anthropic", "anthropic_key": "x" * 40}, headers=CSRF)
    assert r.status_code == 403
    assert db.writes() == []


def test_data_export_says_it_is_not_wired(stack):
    client, db, order = stack()
    assert client.get("/management/export-data").status_code == 501
    assert db.calls == []
