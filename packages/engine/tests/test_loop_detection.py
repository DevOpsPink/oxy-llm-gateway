import asyncio
from datetime import datetime, timezone, timedelta

import pytest

from workers.agent_anomaly_detector import AgentAnomalyDetector, LOOP_THRESHOLD, LOOP_WINDOW_SECONDS


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def incr(self, key: str):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]

    async def expire(self, key: str, ttl: int):
        # no-op for test; TTL not simulated
        return True


class FakeSupabase:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return self

    def select(self, *_cols, **__kwargs):
        return self

    def eq(self, _field, _value):
        return self

    def gte(self, _field, _value):
        return self

    def order(self, *_args, **__kwargs):
        return self

    def limit(self, _n):
        return self

    async def execute(self):
        class Resp:
            def __init__(self, data):
                self.data = data
        return Resp(self.rows)


@pytest.mark.asyncio
async def test_loop_detection_triggers_on_repeated_prompts():
    now = datetime.now(timezone.utc)
    rows = [
        {
            "id": f"log-{i}",
            "organization_id": "org-1",
            "agent_id": "agent-1",
            "project_id": "proj-1",
            "created_at": (now - timedelta(seconds=i)).isoformat(),
            "prompt_snapshot": "Repeat me please",
            "privacy_mode": "metadata_only",
        }
        for i in range(LOOP_THRESHOLD)
    ]
    detector = AgentAnomalyDetector(FakeSupabase(rows), FakeRedis())

    anomaly = await detector._check_looping_behavior({"id": "agent-1", "organization_id": "org-1"})

    assert anomaly is not None
    assert anomaly["type"] == "looping_behavior"
    assert anomaly["details"]["count"] >= LOOP_THRESHOLD


@pytest.mark.asyncio
async def test_loop_detection_skips_without_prompt_due_to_privacy():
    now = datetime.now(timezone.utc)
    rows = [
        {
            "id": "log-1",
            "organization_id": "org-1",
            "agent_id": "agent-1",
            "project_id": "proj-1",
            "created_at": now.isoformat(),
            "prompt_snapshot": None,
            "privacy_mode": "zero_prompt_logging",
        }
    ]
    detector = AgentAnomalyDetector(FakeSupabase(rows), FakeRedis())

    anomaly = await detector._check_looping_behavior({"id": "agent-1", "organization_id": "org-1"})

    assert anomaly is None
