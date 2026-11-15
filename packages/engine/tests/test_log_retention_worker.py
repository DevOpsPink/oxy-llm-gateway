import pytest
from datetime import datetime, timedelta, timezone


def _to_utc(dt: datetime) -> datetime:
    """
    Normalize a datetime to UTC-aware, so we can safely compare them in tests.
    - If dt is naive, assume it's in UTC and attach timezone.utc.
    - If dt already has tzinfo, convert it to UTC.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

from workers import log_retention
from core import addons as addons_module


class FakeHttpClient:
    def __init__(self):
        self.deletes = []

    async def delete(self, url, params=None, headers=None):
        self.deletes.append((url, params))
        return True


class FakeAddOnClient:
    def __init__(self, addon_ids):
        self.addon_ids = addon_ids
        self.calls = []

    async def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append((url, params))

        class Res:
            status_code = 200

            def raise_for_status(self): ...

            def json(inner_self):
                return [{"add_on_id": add_on} for add_on in self.addon_ids]

        return Res()


def test_build_retention_params():
    org_id = "org-1"
    days = 30
    params = log_retention.build_retention_params(org_id, days)
    assert params["organization_id"] == f"eq.{org_id}"
    assert "created_at" in params
    cutoff_str = params["created_at"].split("lt.")[-1]
    cutoff = datetime.fromisoformat(cutoff_str)
    now = datetime.now(timezone.utc)
    delta = now - cutoff
    assert delta.days in (29, 30, 31)  # allow slight variance due to timing


def test_clamp_days_bounds():
    assert log_retention._clamp_days(None) == 365
    assert log_retention._clamp_days(1) == 7
    assert log_retention._clamp_days(7) == 7
    assert log_retention._clamp_days(2555) == 2555
    assert log_retention._clamp_days(99999) == 2555
    assert log_retention._clamp_days("not-an-int") == 365


def build_org(retention_days):
    return {"id": "org-1", "request_log_retention_days": retention_days}


@pytest.mark.asyncio
async def test_log_retention_respects_min_max_bounds():
    fake_http = FakeHttpClient()
    log_retention.resources.http_client = fake_http  # type: ignore
    addons_module.resources.http_client = FakeAddOnClient(addon_ids=[])
    await log_retention.run_log_retention([build_org(1)])
    url, params = fake_http.deletes[0]
    cutoff_dt = datetime.fromisoformat(params["created_at"].split(".", 1)[0])
    expected_dt = datetime.now(timezone.utc) - timedelta(days=log_retention.MIN_RETENTION_DAYS)
    cutoff_dt = _to_utc(cutoff_dt)
    expected_dt = _to_utc(expected_dt)
    assert abs((cutoff_dt - expected_dt).total_seconds()) < 5

    fake_http.deletes.clear()
    addons_module.resources.http_client = FakeAddOnClient(addon_ids=[])
    await log_retention.run_log_retention([build_org(999999)])
    url, params = fake_http.deletes[0]
    cutoff_dt = datetime.fromisoformat(params["created_at"].split(".", 1)[0])
    expected_dt = datetime.now(timezone.utc) - timedelta(days=log_retention.MAX_RETENTION_DAYS)
    cutoff_dt = _to_utc(cutoff_dt)
    expected_dt = _to_utc(expected_dt)
    assert abs((cutoff_dt - expected_dt).total_seconds()) < 5


@pytest.mark.asyncio
async def test_log_retention_uses_addon_window_when_enabled():
    fake_http = FakeHttpClient()
    log_retention.resources.http_client = fake_http  # type: ignore
    addons_module.resources.http_client = FakeAddOnClient(addon_ids=["audit_logs"])

    await log_retention.run_log_retention([build_org(365)])
    url, params = fake_http.deletes[0]
    cutoff_dt = datetime.fromisoformat(params["created_at"].split(".", 1)[0])
    expected_dt = datetime.now(timezone.utc) - timedelta(days=log_retention.ADDON_RETENTION_DAYS)
    cutoff_dt = _to_utc(cutoff_dt)
    expected_dt = _to_utc(expected_dt)
    assert abs((cutoff_dt - expected_dt).total_seconds()) < 5

