"""Stripe billing is optional: endpoints that call Stripe answer 503 without credentials."""

import pytest
from fastapi import HTTPException

from billing_gate import billing_enabled, require_billing


@pytest.mark.asyncio
async def test_billing_disabled_without_stripe_credentials(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    assert billing_enabled() is False
    with pytest.raises(HTTPException) as exc:
        await require_billing()
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_billing_enabled_with_both_stripe_credentials(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "placeholder")
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    assert billing_enabled() is False
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "placeholder")
    assert billing_enabled() is True
    await require_billing()
