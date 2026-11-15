import importlib
from decimal import Decimal

import routes.credits as credits


ENV_KEYS = ("REFERRAL_CREDIT_AMOUNT_USD", "REFERRAL_MAX_PER_REFERRER_USD")


def _reload_credits(monkeypatch, env: dict):
    for key in ENV_KEYS:
        if key in env:
            monkeypatch.setenv(key, env[key])
        else:
            monkeypatch.delenv(key, raising=False)
    return importlib.reload(credits)


def test_defaults_are_applied(monkeypatch):
    mod = _reload_credits(monkeypatch, {})

    assert mod.REFERRAL_CREDIT_AMOUNT == Decimal("100.00")
    assert mod.REFERRAL_MAX_PER_REFERRER == Decimal("1000.00")


def test_invalid_env_values_fall_back(monkeypatch, caplog):
    caplog.set_level("WARNING")
    mod = _reload_credits(
        monkeypatch,
        {
            "REFERRAL_CREDIT_AMOUNT_USD": "not-a-number",
            "REFERRAL_MAX_PER_REFERRER_USD": "also-not-a-number",
        },
    )

    assert mod.REFERRAL_CREDIT_AMOUNT == Decimal("100.00")
    assert mod.REFERRAL_MAX_PER_REFERRER == Decimal("1000.00")
    assert "Invalid decimal for REFERRAL_CREDIT_AMOUNT_USD" in caplog.text
    assert "Invalid decimal for REFERRAL_MAX_PER_REFERRER_USD" in caplog.text

