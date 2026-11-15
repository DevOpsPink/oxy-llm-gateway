import builtins
import types
import os
import sys
import pytest

# Add engine path for module imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import integrations.hubspot as hs  # type: ignore


class DummyResponse:
    def __init__(self, status_code=200, json_body=None):
        self.status_code = status_code
        self._json = json_body or {}

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            from requests import HTTPError
            raise HTTPError(f"status={self.status_code}")


def test_hubspot_disabled_short_circuits(monkeypatch):
    monkeypatch.setattr(hs, "HUBSPOT_ENABLED", False)
    assert hs.sync_user_to_hubspot({"email": "a@b.com"}) == {}
    assert hs.track_subscription_in_hubspot({"email": "a@b.com"}, "plan", 10) == {}
    assert hs.track_churn_in_hubspot("a@b.com") is None


def test_hubspot_success(monkeypatch):
    monkeypatch.setattr(hs, "HUBSPOT_ENABLED", True)
    monkeypatch.setattr(hs, "HUBSPOT_API_KEY", "key")

    calls = []

    def fake_request(method, url, json=None, headers=None, timeout=None):
        calls.append((method, url))
        return DummyResponse(200, {"results": [{"id": "123"}]} if "search" in url else {"id": "123"})

    monkeypatch.setattr(hs.requests, "request", fake_request)

    contact = hs.sync_user_to_hubspot({"email": "a@b.com", "full_name": "Test User"})
    assert contact.get("id") == "123"
    deal = hs.track_subscription_in_hubspot({"email": "a@b.com"}, "growth", 49)
    assert deal.get("id") == "123"


def test_hubspot_transient_retry(monkeypatch):
    monkeypatch.setattr(hs, "HUBSPOT_ENABLED", True)
    monkeypatch.setattr(hs, "HUBSPOT_API_KEY", "key")
    monkeypatch.setattr(hs, "HUBSPOT_MAX_RETRIES", 2)
    attempts = {"n": 0}

    def fake_request(method, url, json=None, headers=None, timeout=None):
        attempts["n"] += 1
        if attempts["n"] == 1:
            return DummyResponse(502)
        return DummyResponse(200, {"results": [{"id": "123"}]} if "search" in url else {"id": "123"})

    monkeypatch.setattr(hs.requests, "request", fake_request)

    contact = hs.sync_user_to_hubspot({"email": "a@b.com"})
    assert contact.get("id") == "123"
    assert attempts["n"] == 2


def test_hubspot_auth_failure_no_retry(monkeypatch):
    monkeypatch.setattr(hs, "HUBSPOT_ENABLED", True)
    monkeypatch.setattr(hs, "HUBSPOT_API_KEY", "key")
    monkeypatch.setattr(hs, "HUBSPOT_MAX_RETRIES", 3)
    attempts = {"n": 0}

    def fake_request(method, url, json=None, headers=None, timeout=None):
        attempts["n"] += 1
        return DummyResponse(401)

    monkeypatch.setattr(hs.requests, "request", fake_request)
    result = hs.sync_user_to_hubspot({"email": "a@b.com"})
    assert result == {}
    assert attempts["n"] == 1
