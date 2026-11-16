"""A key's last use reaches api_keys.last_used_at, once a minute at most.

Nothing wrote the column up to 1.0.4: the dashboard's API Keys page showed
"Never" for a key that had just sent twenty requests.
"""
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis

from core import resources


class Database:
    def __init__(self, fail=False):
        self.writes = []
        self.fail = fail

    async def patch(self, url, params=None, headers=None, json=None, **kwargs):
        if self.fail:
            raise RuntimeError("the database is down")
        self.writes.append((url.rsplit("/rest/v1/", 1)[-1], params, sorted(json)))
        return SimpleNamespace(status_code=204, raise_for_status=lambda: None)


class BrokenRedis:
    async def set(self, *args, **kwargs):
        raise ConnectionError("Redis is down")


@pytest_asyncio.fixture
async def env(monkeypatch):
    redis = FakeAsyncRedis(decode_responses=True)
    db = Database()
    monkeypatch.setattr(resources, "redis", redis)
    monkeypatch.setattr(resources, "http_client", db)
    yield SimpleNamespace(redis=redis, db=db)
    await redis.aclose()


@pytest.mark.asyncio
async def test_a_used_key_gets_its_last_use_written_once_a_minute(env):
    from routes.proxy import KEY_USE_WINDOW_SECONDS, touch_key_last_used
    assert await touch_key_last_used("key-1") is True
    assert await touch_key_last_used("key-1") is False   # the same minute: no second write
    assert await touch_key_last_used("key-2") is True    # another key has its own minute
    assert env.db.writes == [("api_keys", {"id": "eq.key-1"}, ["last_used_at"]),
                             ("api_keys", {"id": "eq.key-2"}, ["last_used_at"])]
    assert 0 < await env.redis.ttl("key_used:key-1") <= KEY_USE_WINDOW_SECONDS


@pytest.mark.asyncio
async def test_a_new_minute_writes_again(env):
    from routes.proxy import touch_key_last_used
    await touch_key_last_used("key-1")
    await env.redis.delete("key_used:key-1")              # the minute is over
    assert await touch_key_last_used("key-1") is True
    assert len(env.db.writes) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("key_id", [None, ""])
async def test_no_key_no_write(env, key_id):
    from routes.proxy import touch_key_last_used
    assert await touch_key_last_used(key_id) is False
    assert env.db.writes == []


@pytest.mark.asyncio
async def test_redis_or_the_database_down_skips_the_write_quietly(env, monkeypatch):
    from routes.proxy import touch_key_last_used
    monkeypatch.setattr(resources, "redis", BrokenRedis())
    assert await touch_key_last_used("key-1") is False
    assert env.db.writes == []
    monkeypatch.setattr(resources, "redis", env.redis)
    monkeypatch.setattr(resources, "http_client", Database(fail=True))
    assert await touch_key_last_used("key-1") is False    # no exception reaches the request


def test_the_gateway_notes_every_request_with_its_key():
    from pathlib import Path
    source = (Path(__file__).resolve().parent.parent / "routes" / "proxy.py").read_text(encoding="utf-8")
    start = source.index("async def chat_completions_proxy(")
    body = source[start:start + 3000]
    assert 'note_key_use(key_data.get("key_id"))' in body
