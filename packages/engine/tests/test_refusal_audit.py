"""Refusals get audit rows; only real threats count as threats.

Up to 1.0.2 a request refused by the burst limit (429), by a suspended
organization (403) or for a body that is not JSON (400) left no request_logs
row, and every served request was counted as a threat ("safe" read as true),
so the dashboard's Threats Blocked card counted every request.
"""
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core import resources

KEY = {
    "organization_id": "org-1", "project_id": "proj-1", "user_id": "user-1", "key_id": "key-1",
    "budget_limit": 0, "api_key": "oxy_live_test", "plan_tier": "free", "org_paused": False,
    "privacy_mode": "metadata_only",
}
BODY = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}]}


class BurstCounter:
    """Redis as the burst limiter sees it: the user's counter is past any limit
    once `over` is set (the proofs set it in Redis the same way)."""

    def __init__(self):
        self.over = False

    async def incr(self, name):
        return 10**9 if self.over and name == "burst:user-1" else 1

    async def expire(self, name, seconds):
        return True

    def __getattr__(self, name):
        async def nothing(*args, **kwargs):
            return None
        return nothing


@pytest.fixture
def proxy(monkeypatch):
    from routes import proxy as p

    refused = []

    async def caller():
        return dict(KEY)

    async def record(**kwargs):
        refused.append(kwargs)

    state = {"org": {"status": "active"}}

    async def org_status(org_id):
        return state["org"]

    monkeypatch.setattr(p, "get_user_and_key_from_api_key", lambda: caller())
    monkeypatch.setattr(p, "record_blocked_request", record)
    monkeypatch.setattr(p, "get_org_status", org_status)
    redis = BurstCounter()
    monkeypatch.setattr(resources, "redis", redis)
    app = FastAPI()
    app.include_router(p.router)
    client = TestClient(app, raise_server_exceptions=False)
    return SimpleNamespace(client=client, refused=refused, redis=redis, state=state)


def post(client, json=None, content=None):
    headers = {"Authorization": "Bearer oxy_live_test"}
    if content is not None:
        return client.post("/v1/chat/completions", content=content, headers={**headers, "Content-Type": "application/json"})
    return client.post("/v1/chat/completions", json=json, headers=headers)


def test_a_burst_limited_request_has_an_audit_row(proxy):
    proxy.redis.over = True
    r = post(proxy.client, json=BODY)
    assert r.status_code == 429
    assert [(x["reason"], x["model"], x["messages"]) for x in proxy.refused] == [("rate_limited", "gpt-4o-mini", [])]
    assert proxy.refused[0]["key_data"]["key_id"] == "key-1"


def test_a_suspended_organization_refusal_has_an_audit_row(proxy):
    proxy.state["org"] = {"status": "suspended", "reason": "manual_toggle"}
    r = post(proxy.client, json=BODY)
    assert r.status_code == 403
    assert [x["reason"] for x in proxy.refused] == ["org_suspended"]


def test_a_body_that_is_not_json_has_an_audit_row(proxy):
    r = post(proxy.client, content="{not json")
    assert r.status_code == 400
    assert [(x["reason"], x["model"]) for x in proxy.refused] == [("invalid_request", "unknown")]


# --------------------------------------------------------------------------- threats

class Table:
    def __init__(self, sink):
        self.sink = sink

    def upsert(self, payload):
        self.sink.append(payload)
        return self

    async def execute(self):
        return SimpleNamespace(status_code=201, error=None, message=None)


@pytest.fixture
def logged(monkeypatch):
    rows = []
    monkeypatch.setattr(resources, "supabase", SimpleNamespace(table=lambda name: Table(rows)))
    return rows


async def record(threat, threat_type="none", **extra):
    from core.costs import record_request
    await record_request(user_id="user-1", project_id="proj-1", organization_id="org-1", model="gpt-4o-mini",
                         provider="openai", status="success", threat=threat, threat_type=threat_type,
                         prompt_tokens=1, completion_tokens=1, cost=Decimal("0"), subscription_id=None,
                         reserved_amount=Decimal("0"), **extra)


@pytest.mark.asyncio
@pytest.mark.parametrize("threat, threat_type, counted", [
    ("safe", "none", False),            # a served request: not a threat
    ("none", "none", False),
    ("blocked", "github_token", True),  # DLP refused it
    ("detected", "credit_card", True),  # DLP in log mode
    ("stream_threat", "jwt", True),     # found in the streamed answer
])
async def test_only_real_threats_count(logged, threat, threat_type, counted):
    await record(threat, threat_type)
    assert [row["threat_detected"] for row in logged] == [counted]


@pytest.mark.asyncio
async def test_a_policy_refusal_is_not_a_threat(logged, monkeypatch):
    from routes import proxy as p
    await p.record_blocked_request(key_data=dict(KEY), model="gpt-4o-mini", messages=[], reason="budget_exceeded",
                                   request_start_ms=0.0)
    assert [(row["threat_type"], row["threat_detected"]) for row in logged] == [("budget_exceeded", False)]


# --------------------------------------------------------------------------- attribution

@pytest.mark.asyncio
async def test_a_served_request_row_names_its_key(monkeypatch):
    # Served rows went through log_request, which took no key: they could not be
    # counted for the key that made them, and a revoke check by key saw 1 of 4.
    from routes import proxy as p
    seen = []

    async def record(**kwargs):
        seen.append(kwargs)

    monkeypatch.setattr(p, "record_request", record)
    await p.log_request("user-1", "proj-1", "org-1", "gpt-4o-mini", "openai", "success", "safe", "none",
                        1, 1, Decimal("0"), None, Decimal("0"), api_key_id="key-1", agent_id="agent-1",
                        session_id="sess-1")
    assert [(r["api_key_id"], r["agent_id"], r["session_id"]) for r in seen] == [("key-1", "agent-1", "sess-1")]


def test_every_log_request_call_passes_the_key():
    import re
    from pathlib import Path
    source = (Path(__file__).resolve().parent.parent / "routes" / "proxy.py").read_text(encoding="utf-8")
    calls = [m.start() for m in re.finditer(r"\n\s+log_request,\n", source)]
    assert calls, "no log_request calls found"
    for start in calls:
        call = source[start:source.index("\n        )", start)]
        assert 'api_key_id=key_data.get("key_id")' in call, call[:300]
