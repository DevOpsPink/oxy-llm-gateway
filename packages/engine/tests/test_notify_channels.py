import pytest
import httpx

from core.notify_channels import SlackNotifier, DiscordNotifier


class DummyResponse:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code


@pytest.mark.asyncio
async def test_slack_notifier_success():
    attempts = []

    async def fake_post(url, payload):
        attempts.append((url, payload))
        return DummyResponse(200)

    notifier = SlackNotifier("https://hooks.slack.com/services/T/B/C", post=fake_post)
    ok = await notifier.send("hello")
    assert ok is True
    assert attempts and attempts[0][0].startswith("https://hooks.slack.com/")
    assert attempts[0][1]["text"] == "hello"


@pytest.mark.asyncio
async def test_discord_notifier_retries_on_5xx_then_succeeds():
    calls = []

    async def fake_post(url, payload):
        calls.append((url, payload))
        if len(calls) == 1:
            return DummyResponse(503)
        return DummyResponse(200)

    notifier = DiscordNotifier("https://discord.com/api/webhooks/123/abc", post=fake_post)
    ok = await notifier.send("hi")
    assert ok is True
    assert len(calls) == 2
    assert calls[0][1]["content"] == "hi"


@pytest.mark.asyncio
async def test_slack_notifier_does_not_retry_on_4xx():
    calls = []

    async def fake_post(url, payload):
        calls.append((url, payload))
        return DummyResponse(404)

    notifier = SlackNotifier("https://hooks.slack.com/services/T/B/C", post=fake_post)
    ok = await notifier.send("nope")
    assert ok is False
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_notifier_retries_on_exception_and_returns_false_after_max():
    calls = []

    async def fake_post(url, payload):
        calls.append((url, payload))
        raise httpx.ConnectTimeout("boom")

    notifier = DiscordNotifier("https://discord.com/api/webhooks/123/abc", post=fake_post)
    ok = await notifier.send("timeout")
    # Will exhaust retries and return False
    assert ok is False
    assert len(calls) == 2
