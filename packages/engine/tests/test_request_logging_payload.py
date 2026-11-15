import pytest
from decimal import Decimal

from core import resources
from core.costs import record_request


class _FakeResponse:
    def __init__(self, status_code=201, error=None):
        self.status_code = status_code
        self.error = error
        self.message = error


class _FakeTable:
    def __init__(self):
        self.inserted = None

    def insert(self, payload):
        self.inserted = payload
        return self

    def upsert(self, payload):
        # record_request writes with a client-side id as an upsert (a retry after a
        # lost response must not create a second row).
        self.inserted = payload
        return self

    def execute(self):
        return _FakeResponse()


class _FakeSupabase:
    def __init__(self):
        self.table_obj = _FakeTable()

    def table(self, _name):
        return self.table_obj


@pytest.mark.asyncio
async def test_record_request_filters_none_fields(monkeypatch):
    fake_supabase = _FakeSupabase()
    monkeypatch.setattr(resources, "supabase", fake_supabase)
    # Avoid budget manager side effects during test
    monkeypatch.setattr(resources, "budget_manager", None, raising=False)

    await record_request(
        user_id="user-1",
        project_id="proj-1",
        organization_id="org-1",
        model="gpt-4",
        provider="openai",
        status="success",
        threat="none",
        threat_type="none",
        prompt_tokens=10,
        completion_tokens=5,
        cost=Decimal("0.01"),
        subscription_id=None,
        reserved_amount=Decimal("0.00"),
        api_key_id=None,
        agent_id=None,
        session_id=None,
        cache_hit=False,
        cost_tags={},
        privacy_mode="metadata_only",
        prompt_text=None,
        response_text=None,
    )

    inserted = fake_supabase.table_obj.inserted
    assert inserted is not None
    # None fields should be removed to avoid Supabase schema violations
    assert "subscription_id" not in inserted
    assert "api_key_id" not in inserted
    assert "agent_id" not in inserted
    assert "session_id" not in inserted

