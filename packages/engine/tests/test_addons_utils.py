from core.addons import compute_project_limit, compute_retention_days
from core.addons import require_add_on
from core import addons as addons_module
import asyncio
import pytest


def test_compute_project_limit_clamps_and_increments():
    # Base without add-on
    assert compute_project_limit(5, has_extra=False, increment=10, hard_max=50) == 5
    # With add-on, within cap
    assert compute_project_limit(5, has_extra=True, increment=10, hard_max=50) == 15
    # Clamp to hard max
    assert compute_project_limit(90, has_extra=True, increment=20, hard_max=100) == 100
    # Already near cap
    assert compute_project_limit(48, has_extra=True, increment=10, hard_max=50) == 50


def test_compute_retention_days_bounds():
    # Base path
    assert compute_retention_days(365, False, 1825, 7, 2555) == 365
    # Add-on extends but still within bounds
    assert compute_retention_days(365, True, 1825, 7, 2555) == 1825
    # Cap at max
    assert compute_retention_days(365, True, 99999, 7, 2555) == 2555
    # Floor at min
    assert compute_retention_days(1, False, 10, 7, 2555) == 7


def _fake_http_get(addons):
    class FakeRes:
        def __init__(self, payload):
            self._payload = payload
            self.status_code = 200

        def raise_for_status(self):
            return

        def json(self):
            return self._payload

    async def fake_get(url, params=None, headers=None, timeout=None):
        return FakeRes(addons)

    return fake_get


@pytest.mark.asyncio
async def test_require_add_on_blocks_without_flag():
    addons_module.resources.http_client.get = _fake_http_get([])
    with pytest.raises(Exception):
        await require_add_on("org-1", "audit_logs", "add-on required")


@pytest.mark.asyncio
async def test_require_add_on_allows_with_flag():
    addons_module.resources.http_client.get = _fake_http_get([{"add_on_id": "audit_logs"}])
    await require_add_on("org-1", "audit_logs", "add-on required")


@pytest.mark.asyncio
async def test_require_add_on_allows_sso_when_enabled():
    addons_module.resources.http_client.get = _fake_http_get([{"add_on_id": "sso"}])
    await require_add_on("org-1", "sso", "sso add-on required")


@pytest.mark.asyncio
async def test_require_add_on_blocks_sso_when_missing():
    addons_module.resources.http_client.get = _fake_http_get([])
    with pytest.raises(Exception):
        await require_add_on("org-1", "sso", "sso add-on required")


def test_compute_project_limit_handles_extra_projects_addon():
    base_limit = 5
    increment = 3
    hard_max = 12
    # No addon -> base
    assert compute_project_limit(base_limit, has_extra=False, increment=increment, hard_max=hard_max) == base_limit
    # With addon -> incremented but capped
    assert compute_project_limit(base_limit, has_extra=True, increment=increment, hard_max=hard_max) == 8
    assert compute_project_limit(11, has_extra=True, increment=increment, hard_max=hard_max) == 12
