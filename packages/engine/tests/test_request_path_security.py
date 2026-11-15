"""
The request path's security properties, offline.

- Keys at rest: Redis holds no tenant API key, in any key name or value; a
  revoked key's cached record goes at once; a budget change reaches every
  cached key of the project; clearing a project's cache never resets its spend.
- Tenancy: agent and session ids from request headers are checked against the
  API key's organization; another tenant's ids are refused.
- Fail closed: a kill flag Redis cannot read is answered by the database or
  refused; a budget that cannot be checked is refused; the spend counter is
  never read as zero when it is missing.

The Lua scripts run for real (fakeredis with lupa), not a Python model of them.
The same properties are measured end to end, each with its planted violation,
in proofs/.
"""

import hashlib
import json
from decimal import Decimal

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis
from fastapi.security import HTTPAuthorizationCredentials

from core import resources
from security_utils import CacheEncryption

KEY = "oxy_live_" + "a1b2c3d4" * 4
KEY_HASH = hashlib.sha256(KEY.encode()).hexdigest()
ORG = "0b5c1d6e-0000-4000-8000-000000000001"
OTHER_ORG = "0b5c1d6e-0000-4000-8000-000000000002"
PROJECT = "0b5c1d6e-0000-4000-8000-0000000000aa"
AGENT = "0b5c1d6e-0000-4000-8000-0000000000a1"
OTHER_AGENT = "0b5c1d6e-0000-4000-8000-0000000000a2"
SESSION = "0b5c1d6e-0000-4000-8000-0000000000b1"


class _Res:
    def __init__(self, data, status=200):
        self._data, self.status_code = data, status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP %s" % self.status_code)

    def json(self):
        return self._data


class FakeHttp:
    """PostgREST stand-in: answers by table name, counts calls, can be made to fail."""

    def __init__(self, tables=None, fail=False):
        self.tables = tables or {}
        self.fail = fail
        self.calls = []

    async def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append(("GET", url, params))
        if self.fail:
            raise ConnectionError("database unreachable")
        table = url.rsplit("/", 1)[-1]
        rows = self.tables.get(table, [])
        want = (params or {}).get("id", "")
        if want.startswith("eq."):
            rows = [r for r in rows if r.get("id") == want[3:]]
        return _Res(rows)

    async def post(self, url, json=None, headers=None, timeout=None):
        self.calls.append(("POST", url, json))
        if self.fail:
            raise ConnectionError("database unreachable")
        if url.endswith("/rpc/fn_validate_api_key"):
            if json.get("p_key_hash") != KEY_HASH:
                return _Res([])
            return _Res([{"api_key_id": "k1", "project_id": PROJECT, "user_id": "u1",
                          "organization_id": ORG, "budget_limit": "1.00"}])
        return _Res([])


class BrokenRedis:
    """A Redis that has stopped answering (the client's timeouts fire)."""

    def __getattr__(self, name):
        async def fail(*args, **kwargs):
            raise ConnectionError("Redis timeout")
        return fail

    def lock(self, *args, **kwargs):
        raise ConnectionError("Redis timeout")


@pytest_asyncio.fixture
async def env():
    saved = {n: getattr(resources, n, None) for n in ("redis", "http_client", "cache_encryption", "supabase")}
    redis = FakeAsyncRedis(decode_responses=True)
    resources.redis = redis
    resources.cache_encryption = CacheEncryption("offline-test-secret")
    resources.supabase = None
    try:
        yield redis
    finally:
        for n, v in saved.items():
            setattr(resources, n, v)
        await redis.flushall()


async def _everything_in(redis) -> str:
    """Every key name and every value in Redis, as one string."""
    out = []
    async for name in redis.scan_iter("*"):
        out.append(name)
        kind = await redis.type(name)
        if kind == "string":
            out.append(str(await redis.get(name)))
        elif kind == "set":
            out.extend(await redis.smembers(name))
        elif kind == "hash":
            out.append(json.dumps(await redis.hgetall(name)))
    return "\n".join(out)


# ----------------------------------------------------------------------------- keys at rest
def test_cache_names_are_the_key_hash():
    from dependencies import api_key_cache_name, api_key_lock_name
    assert api_key_cache_name(KEY) == "api_key:" + KEY_HASH
    assert KEY not in api_key_cache_name(KEY) and KEY not in api_key_lock_name(KEY)


@pytest.mark.asyncio
async def test_key_lookup_leaves_no_key_in_redis(env):
    from dependencies import get_user_and_key_from_api_key
    http = FakeHttp()
    resources.http_client = http
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=KEY)

    first = await get_user_and_key_from_api_key(creds)
    second = await get_user_and_key_from_api_key(creds)

    assert first["project_id"] == second["project_id"] == PROJECT
    assert len([c for c in http.calls if c[1].endswith("fn_validate_api_key")]) == 1, "second lookup is cached"
    stored = await _everything_in(env)
    assert KEY not in stored
    assert await env.smembers("project_keys:" + PROJECT) == {KEY_HASH}


@pytest.mark.asyncio
async def test_revocation_drops_the_cached_record(env):
    from dependencies import forget_cached_api_key, get_user_and_key_from_api_key
    resources.http_client = FakeHttp()
    await get_user_and_key_from_api_key(HTTPAuthorizationCredentials(scheme="Bearer", credentials=KEY))
    assert await env.exists("api_key:" + KEY_HASH)

    await forget_cached_api_key(KEY_HASH, PROJECT)

    assert not await env.exists("api_key:" + KEY_HASH)
    assert KEY_HASH not in await env.smembers("project_keys:" + PROJECT)


@pytest.mark.asyncio
async def test_redis_down_key_lookup_uses_the_database(env):
    from dependencies import get_user_and_key_from_api_key
    resources.redis = BrokenRedis()
    resources.http_client = FakeHttp()
    data = await get_user_and_key_from_api_key(HTTPAuthorizationCredentials(scheme="Bearer", credentials=KEY))
    assert data["organization_id"] == ORG


@pytest.mark.asyncio
async def test_project_cache_clear_reaches_every_key_and_keeps_the_spend(env):
    from redis_scripts import LUA_CLEAR_PROJECT_CACHE
    from dependencies import get_user_and_key_from_api_key
    resources.http_client = FakeHttp()
    # A key made at onboarding: it reaches the project's set only by being used.
    await get_user_and_key_from_api_key(HTTPAuthorizationCredentials(scheme="Bearer", credentials=KEY))
    await env.set("project_spend:" + PROJECT, "0.42")

    deleted, total, _ = await env.eval(LUA_CLEAR_PROJECT_CACHE, 0, PROJECT)

    assert (deleted, total) == (1, 1)
    assert not await env.exists("api_key:" + KEY_HASH)
    assert await env.get("project_spend:" + PROJECT) == "0.42"


# ----------------------------------------------------------------------------- tenancy
def _sessions(status="running", org=ORG, agent=AGENT, kill_requested_at=None):
    return {"agent_sessions": [{"id": SESSION, "organization_id": org, "agent_id": agent,
                                "status": status, "kill_requested_at": kill_requested_at}],
            "agents": [{"id": AGENT, "organization_id": ORG}]}


@pytest.mark.asyncio
async def test_own_session_resolves_with_its_agent(env):
    from routes.proxy import resolve_agent_context
    resources.http_client = FakeHttp(_sessions())
    ctx = await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)
    assert ctx["session_id"] == SESSION and ctx["agent_id"] == AGENT


@pytest.mark.asyncio
async def test_another_tenants_session_is_refused(env):
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp(_sessions())
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-agent-id": AGENT, "x-oxy-session-id": SESSION}, OTHER_ORG)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_unknown_session_gets_the_same_answer_as_a_foreign_one(env):
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp({"agent_sessions": []})
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)
    assert (exc.value.status_code, exc.value.code) == (403, "session_not_in_organization")


@pytest.mark.asyncio
async def test_session_of_another_agent_is_refused(env):
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp(_sessions())
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-agent-id": OTHER_AGENT, "x-oxy-session-id": SESSION}, ORG)
    assert exc.value.code == "session_not_of_agent"


@pytest.mark.asyncio
async def test_another_tenants_agent_is_refused(env):
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp(_sessions())
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-agent-id": AGENT}, OTHER_ORG)
    assert exc.value.code == "agent_not_in_organization"


@pytest.mark.asyncio
async def test_malformed_ids_are_refused(env):
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp(_sessions())
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-session-id": "not-a-uuid"}, ORG)
    assert exc.value.status_code == 400


# ----------------------------------------------------------------------------- kill switch, fail closed
@pytest.mark.asyncio
async def test_session_killed_in_the_database_is_refused_without_a_flag(env):
    """The Redis flag can expire or be lost; the agent_sessions row still refuses."""
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp(_sessions(status="killed"))
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)
    assert exc.value.status_code == 410


@pytest.mark.asyncio
async def test_session_killed_by_flag_is_refused_while_its_row_is_cached(env):
    from core.control import mark_session_terminated
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.http_client = FakeHttp(_sessions())
    await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)  # caches the live row
    await mark_session_terminated(SESSION)
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)
    assert exc.value.status_code == 410


@pytest.mark.asyncio
async def test_redis_down_killed_session_is_refused_by_the_database(env):
    from routes.proxy import AgentContextRefused, resolve_agent_context
    resources.redis = BrokenRedis()
    resources.http_client = FakeHttp(_sessions(status="killed"))
    with pytest.raises(AgentContextRefused) as exc:
        await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)
    assert exc.value.status_code == 410


@pytest.mark.asyncio
async def test_redis_down_live_session_is_served_by_the_database(env):
    from routes.proxy import resolve_agent_context
    resources.redis = BrokenRedis()
    resources.http_client = FakeHttp(_sessions())
    ctx = await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)
    assert ctx["agent_id"] == AGENT


@pytest.mark.asyncio
async def test_redis_and_database_down_session_request_is_refused(env):
    from core.control import ControlUnavailable
    from routes.proxy import resolve_agent_context
    resources.redis = BrokenRedis()
    resources.http_client = FakeHttp(_sessions(), fail=True)
    with pytest.raises(ControlUnavailable):
        await resolve_agent_context({"x-oxy-session-id": SESSION}, ORG)


@pytest.mark.asyncio
async def test_unreadable_kill_flag_is_never_read_as_alive(env):
    from core.control import ControlUnavailable, check_execution_allowed, is_session_terminated
    resources.redis = BrokenRedis()
    with pytest.raises(ControlUnavailable):
        await is_session_terminated(SESSION)
    result = await check_execution_allowed(org_id=ORG, session_id=SESSION)
    assert (result["allowed"], result["status_code"]) == (False, 503)


# ----------------------------------------------------------------------------- budget ledger
@pytest.mark.asyncio
async def test_missing_spend_counter_is_seeded_from_the_mirror(env):
    """A counter Redis lost is never read as zero: it resumes from projects.current_spend."""
    from core.budget import BudgetManager
    resources.http_client = FakeHttp({"projects": [{"id": PROJECT, "current_spend": "0.049"}]})
    manager = BudgetManager(env)

    result = await manager.reserve_budget(PROJECT, ORG, Decimal("0.002"), Decimal("0.05"))

    assert result["status"] == "BUDGET_EXCEEDED"
    assert Decimal(await env.get("project_spend:" + PROJECT)) == Decimal("0.049")


@pytest.mark.asyncio
async def test_spend_counter_that_cannot_be_seeded_refuses(env):
    from core.budget import BudgetManager, BudgetUnavailable
    resources.http_client = FakeHttp(fail=True)
    with pytest.raises(BudgetUnavailable):
        await BudgetManager(env).reserve_budget(PROJECT, ORG, Decimal("0.002"), Decimal("0.05"))


@pytest.mark.asyncio
async def test_budget_reservation_with_redis_down_raises(env):
    """No database fallback: the proxy turns this into a 503 and an audit row."""
    from core.budget import BudgetManager

    class Script:
        async def __call__(self, *a, **k):
            raise ConnectionError("Redis timeout")

    class DownRedis:
        def register_script(self, _):
            return Script()

    with pytest.raises(Exception):
        await BudgetManager(DownRedis()).reserve_budget(PROJECT, ORG, Decimal("0.002"), Decimal("0.05"))


@pytest.mark.asyncio
async def test_adjust_and_return_never_create_a_counter(env):
    from core.budget import BudgetManager
    manager = BudgetManager(env)
    assert (await manager.adjust_budget(PROJECT, Decimal("0.001")))["status"] == "MISSING"
    assert (await manager.return_budget(PROJECT, Decimal("0.001")))["status"] == "MISSING"
    assert not await env.exists("project_spend:" + PROJECT)


@pytest.mark.asyncio
async def test_concurrent_reservations_never_pass_the_budget(env):
    import asyncio
    from core.budget import BudgetManager
    await env.set("project_spend:" + PROJECT, "0")
    manager = BudgetManager(env)
    results = await asyncio.gather(*[
        manager.reserve_budget(PROJECT, ORG, Decimal("0.01"), Decimal("0.05")) for _ in range(20)
    ])
    assert sum(1 for r in results if r["status"] == "OK") == 5
    assert Decimal(await env.get("project_spend:" + PROJECT)) <= Decimal("0.05")


# ----------------------------------------------------------------------------- kill through the agents route
class _SessionsTable:
    """agent_sessions with update().eq()...in_().execute(), as the engine's client chains it."""

    def __init__(self, rows):
        self.rows, self._filters, self._update = rows, [], None

    def update(self, data):
        self._update, self._filters = data, []
        return self

    def eq(self, col, val):
        self._filters.append((col, [val]))
        return self

    def in_(self, col, vals):
        self._filters.append((col, list(vals)))
        return self

    async def execute(self):
        hit = [r for r in self.rows if all(r.get(c) in vs for c, vs in self._filters)]
        for r in hit:
            r.update(self._update)
        return type("R", (), {"data": hit})


class _Supabase:
    def __init__(self, rows):
        self.sessions = _SessionsTable(rows)

    def table(self, name):
        assert name == "agent_sessions"
        return self.sessions


@pytest.mark.asyncio
async def test_agents_route_cannot_kill_another_organizations_session(env):
    """The kill flag used to be set before the organization check."""
    from fastapi import HTTPException
    from routes.agents import SessionKill, kill_session
    rows = [{"id": SESSION, "agent_id": AGENT, "organization_id": ORG, "status": "running"}]
    resources.supabase = _Supabase(rows)
    with pytest.raises(HTTPException) as exc:
        await kill_session(AGENT, SESSION, SessionKill(), auth={"organization_id": OTHER_ORG, "user_id": "u2"})
    assert exc.value.status_code == 404
    assert not await env.exists("oxy:session:%s:terminated" % SESSION)
    assert rows[0]["status"] == "running"


@pytest.mark.asyncio
async def test_agents_route_kills_its_own_session(env):
    from routes.agents import SessionKill, kill_session
    rows = [{"id": SESSION, "agent_id": AGENT, "organization_id": ORG, "status": "running"}]
    resources.supabase = _Supabase(rows)
    out = await kill_session(AGENT, SESSION, SessionKill(), auth={"organization_id": ORG, "user_id": "u1"})
    assert out["killed"] is True and rows[0]["status"] == "killed"
    assert await env.exists("oxy:session:%s:terminated" % SESSION)


# ----------------------------------------------------------------------------- response cache per organization
@pytest.mark.asyncio
async def test_response_cache_is_never_shared_between_organizations(env):
    """The cache key used to leave the organization out: one tenant got another's answer."""
    from core.response_cache import ResponseCache
    cache = ResponseCache(env)
    messages = [{"role": "user", "content": "the same deterministic question"}]
    params = {"temperature": 0}
    await cache.set_cached_response("openai", "gpt-4o-mini", messages, params,
                                    {"choices": [{"message": {"content": "org one's answer"}}]}, 0.001, scope=ORG)
    assert await cache.get_cached_response("openai", "gpt-4o-mini", messages, params, scope=ORG) is not None
    assert await cache.get_cached_response("openai", "gpt-4o-mini", messages, params, scope=OTHER_ORG) is None


# ----------------------------------------------------------------------------- the dashboard's session on /v1 routes
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2ln"


@pytest.mark.asyncio
async def test_dashboard_session_resolves_to_its_organization(env, monkeypatch):
    import dependencies as d

    async def user(_creds):
        return {"id": "u1"}

    monkeypatch.setattr(d, "get_current_user", user)
    resources.http_client = FakeHttp({"organization_members": [{"organization_id": ORG, "role": "developer"}],
                                      "projects": [{"id": PROJECT, "budget_limit": "2.00"}]})
    dep = d.build_api_key_dependency(lambda: d.get_user_and_key_from_api_key, allow_session=True)
    ctx = await dep(HTTPAuthorizationCredentials(scheme="Bearer", credentials=JWT))
    assert (ctx["organization_id"], ctx["project_id"], ctx["user_id"]) == (ORG, PROJECT, "u1")


@pytest.mark.asyncio
async def test_session_without_membership_is_refused(env, monkeypatch):
    from fastapi import HTTPException
    import dependencies as d

    async def user(_creds):
        return {"id": "u9"}

    monkeypatch.setattr(d, "get_current_user", user)
    resources.http_client = FakeHttp({"organization_members": []})
    dep = d.build_api_key_dependency(lambda: d.get_user_and_key_from_api_key, allow_session=True)
    with pytest.raises(HTTPException) as exc:
        await dep(HTTPAuthorizationCredentials(scheme="Bearer", credentials=JWT))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_gateway_routes_still_take_keys_only(env):
    """Without allow_session (the gateway, /v1/api-keys) a session is not a key."""
    from fastapi import HTTPException
    import dependencies as d
    resources.http_client = FakeHttp()
    dep = d.build_api_key_dependency(lambda: d.get_user_and_key_from_api_key)
    with pytest.raises(HTTPException) as exc:
        await dep(HTTPAuthorizationCredentials(scheme="Bearer", credentials=JWT))
    assert exc.value.status_code == 401
