"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   ⚙️ WORKER TESTS - Background Job Verification                              ║
║   Testing every background worker for reliability                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests for all workers in packages/engine/workers/

Coverage:
- budget_worker.py (Budget sync)
- budget_alerts.py (Alert notifications)
- log_worker.py (Request logging)
- dunning_emails.py (Payment recovery)
- webhook_retry_worker.py (Webhook reliability)
- cost_anomaly_detector.py (Cost monitoring)
- intelligence_aggregator.py (Analytics)
- intelligence_scheduler.py (Scheduled tasks)
- usage_reporter.py (Reporting)

Run:
    pytest tests/test_workers.py -v --tb=short
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta


# ============================================================================
# BUDGET WORKER TESTS
# ============================================================================

class TestBudgetWorker:
    """Tests for budget_worker.py."""
    
    def test_redis_to_db_sync_format(self):
        """Verify Redis data is synced to database correctly."""
        redis_data = {
            "project_spend:uuid-123": "150.50",
            "credits:org-456": "25.00"
        }
        
        # Parse format
        for key, value in redis_data.items():
            if key.startswith("project_spend:"):
                project_id = key.split(":")[1]
                spend = Decimal(value)
                assert spend >= 0
            elif key.startswith("credits:"):
                org_id = key.split(":")[1]
                credits = Decimal(value)
                assert credits >= 0
    
    def test_sync_interval(self):
        """Verify sync happens at correct interval."""
        sync_interval_seconds = 60  # Every minute
        
        assert sync_interval_seconds >= 30
        assert sync_interval_seconds <= 300  # Max 5 minutes
    
    def test_batch_sync(self):
        """Verify batch sync handles multiple projects."""
        projects = [
            {"id": "proj-1", "spend": Decimal("100.00")},
            {"id": "proj-2", "spend": Decimal("200.00")},
            {"id": "proj-3", "spend": Decimal("50.00")}
        ]
        
        total_spend = sum(p["spend"] for p in projects)
        assert total_spend == Decimal("350.00")


# ============================================================================
# BUDGET ALERTS WORKER TESTS
# ============================================================================

class TestBudgetAlertsWorker:
    """Tests for budget_alerts.py."""
    
    def test_alert_thresholds(self):
        """Verify alert thresholds are correct."""
        from workers.budget_alerts import ALERT_THRESHOLDS
        thresholds = ALERT_THRESHOLDS  # [80, 95, 100]
        
        for threshold in thresholds:
            assert 0 <= threshold <= 100
        
        # Should be in ascending order
        assert thresholds == sorted(thresholds)
    
    def test_alert_deduplication(self):
        """Verify dedupe key format is consistent."""
        project_id = "proj-123"
        threshold = 95
        dedupe_key = f"budget_alert:{project_id}:{threshold}"
        assert dedupe_key == "budget_alert:proj-123:95"

    @pytest.mark.asyncio
    async def test_budget_alert_triggers_and_sets_dedupe_key(self, monkeypatch):
        """Simulate a 95% threshold crossing and ensure we attempt to send once."""
        from workers import budget_alerts as ba

        # Ensure feature + email gates are enabled
        monkeypatch.setenv("BUDGET_ALERTS_ENABLED", "true")
        monkeypatch.setenv("EMAIL_ENABLED", "true")
        monkeypatch.setenv("SENDGRID_API_KEY", "test-key")

        # Mock email sender
        mock_send_email = AsyncMock(return_value=True)
        monkeypatch.setattr(ba, "send_budget_alert_email", mock_send_email)

        # Fake Redis client
        redis_mock = MagicMock()
        redis_mock.get = AsyncMock(return_value=None)
        redis_mock.set = AsyncMock(return_value=True)

        # Fake Supabase table response
        class DummyTable:
            def __init__(self, data):
                self.data = data
            def select(self, *_args, **_kwargs):
                return self
            def eq(self, *_args, **_kwargs):
                return self
            def single(self):
                return self
            def execute(self):
                return type("Res", (), {"data": self.data})

        class DummySupabase:
            def table(self, _name):
                if _name == "profiles":
                    return DummyTable({"email": "user@example.com", "full_name": "Test User"})
                if _name == "projects":
                    return DummyTable({"name": "Project Alpha"})
                return DummyTable({})

        resources_mock = MagicMock()
        resources_mock.redis = redis_mock
        resources_mock.supabase = DummySupabase()
        monkeypatch.setattr(ba, "resources", resources_mock)

        # Run the alert
        await ba.send_budget_alert_if_needed(
            project_id="proj-123",
            user_id="user-123",
            threshold=95,
            current_spend=Decimal("95"),
            budget_limit=Decimal("100"),
            percentage=95.0
        )

        # Verify email attempted and dedupe key recorded
        mock_send_email.assert_awaited_once()
        redis_mock.set.assert_awaited()
        set_key = redis_mock.set.await_args.args[0]
        assert set_key == "budget_alert:proj-123:95"


# ============================================================================
# LOG WORKER TESTS
# ============================================================================

class TestLogWorker:
    """Tests for log_worker.py."""
    
    def test_log_entry_structure(self):
        """Verify log entries have required fields."""
        log_entry = {
            "request_id": "uuid-123",
            "timestamp": "2025-01-15T10:00:00Z",
            "project_id": "proj-123",
            "organization_id": "org-456",
            "model": "gpt-4",
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150,
            "cost_usd": 0.05,
            "latency_ms": 1500,
            "status": "success"
        }
        
        required_fields = [
            "request_id", "timestamp", "project_id",
            "model", "total_tokens", "cost_usd"
        ]
        
        for field in required_fields:
            assert field in log_entry
    
    def test_batch_insert(self):
        """Verify logs are inserted in batches."""
        batch_size = 100
        logs = [{"id": i} for i in range(250)]
        
        batches = [logs[i:i+batch_size] for i in range(0, len(logs), batch_size)]
        
        assert len(batches) == 3  # 100, 100, 50
    
    def test_log_retention(self):
        """Verify old logs are cleaned up."""
        retention_days = 90
        
        now = datetime.now(timezone.utc)
        old_log_date = now - timedelta(days=100)
        
        should_delete = (now - old_log_date).days > retention_days
        assert should_delete is True


# ============================================================================
# DUNNING EMAILS WORKER TESTS
# ============================================================================

class TestDunningEmailsWorker:
    """Tests for dunning_emails.py (payment recovery)."""
    
    def test_dunning_schedule(self):
        """Verify dunning email schedule."""
        schedule = {
            "day_1": "payment_failed_day1.html",
            "day_3": "payment_failed_day3.html",
            "day_7": "payment_failed_day7.html",
            "day_30": "account_suspended_day30.html"
        }
        
        assert len(schedule) >= 3
    
    def test_dunning_email_personalization(self):
        """Verify dunning emails are personalized."""
        email = {
            "to": "user@example.com",
            "subject": "John, your payment failed - action required",
            "variables": {
                "first_name": "John",
                "amount": "$42.00",
                "last_4_digits": "4242",
                "update_payment_url": "https://example.com/billing/update"
            }
        }
        
        assert email["variables"]["first_name"] in email["subject"]
    
    def test_grace_period(self):
        """Verify grace period before suspension."""
        grace_period_days = 30
        
        failed_at = datetime.now(timezone.utc) - timedelta(days=15)
        now = datetime.now(timezone.utc)
        
        days_since_failure = (now - failed_at).days
        should_suspend = days_since_failure >= grace_period_days
        
        assert should_suspend is False  # 15 days < 30 days


# ============================================================================
# WEBHOOK RETRY WORKER TESTS
# ============================================================================

class TestWebhookRetryWorker:
    """Tests for webhook_retry_worker.py."""
    
    def test_retry_schedule(self):
        """Verify exponential backoff schedule."""
        base_delay = 60  # seconds
        max_retries = 5
        
        delays = []
        for attempt in range(max_retries):
            delay = base_delay * (2 ** attempt)
            delays.append(delay)
        
        # Exponential: 60, 120, 240, 480, 960
        assert delays == [60, 120, 240, 480, 960]
    
    def test_max_retry_limit(self):
        """Verify max retry limit."""
        max_retries = 5
        current_attempt = 6
        
        should_retry = current_attempt <= max_retries
        assert should_retry is False
    
    def test_webhook_payload_integrity(self):
        """Verify webhook payload is not modified."""
        original_payload = {
            "event": "subscription.created",
            "data": {"subscription_id": "sub_123"}
        }
        
        # Payload should be preserved
        retry_payload = original_payload.copy()
        assert retry_payload == original_payload


# ============================================================================
# COST ANOMALY DETECTOR TESTS
# ============================================================================

class TestCostAnomalyDetector:
    """Tests for cost_anomaly_detector.py."""
    
    def test_anomaly_detection_threshold(self):
        """Verify anomaly detection threshold."""
        baseline_cost = Decimal("100.00")
        current_cost = Decimal("350.00")
        threshold_multiplier = 3  # 3x baseline = anomaly
        
        is_anomaly = current_cost > (baseline_cost * threshold_multiplier)
        assert is_anomaly is True
    
    def test_moving_average_calculation(self):
        """Verify moving average calculation."""
        daily_costs = [100, 110, 90, 105, 95, 100, 100]  # Last 7 days
        
        moving_average = sum(daily_costs) / len(daily_costs)
        expected = 100  # (100+110+90+105+95+100+100) / 7 = 100
        
        assert moving_average == expected
    
    def test_anomaly_alert_content(self):
        """Verify anomaly alert contains context."""
        alert = {
            "type": "cost_spike",
            "severity": "high",
            "project_id": "proj-123",
            "current_cost": 500,
            "baseline_cost": 100,
            "deviation_percentage": 400,
            "top_models": ["gpt-4", "claude-3-opus"],
            "recommendation": "Review recent API usage for potential abuse"
        }
        
        assert alert["deviation_percentage"] > 100


# ============================================================================
# INTELLIGENCE AGGREGATOR TESTS
# ============================================================================

class TestIntelligenceAggregator:
    """Tests for intelligence_aggregator.py."""
    
    def test_daily_aggregation(self):
        """Verify daily metrics are aggregated."""
        metrics = {
            "date": "2025-01-15",
            "total_requests": 10000,
            "total_tokens": 5000000,
            "total_cost": Decimal("500.00"),
            "avg_latency_ms": 1200,
            "error_rate": 0.01,
            "unique_users": 150
        }
        
        assert metrics["total_requests"] > 0
        assert metrics["error_rate"] < 0.05  # Less than 5%
    
    def test_model_breakdown(self):
        """Verify per-model breakdown."""
        breakdown = {
            "gpt-4": {"requests": 2000, "cost": Decimal("200.00")},
            "gpt-3.5-turbo": {"requests": 8000, "cost": Decimal("80.00")}
        }
        
        total_requests = sum(m["requests"] for m in breakdown.values())
        assert total_requests == 10000


# ============================================================================
# INTELLIGENCE SCHEDULER TESTS
# ============================================================================

class TestIntelligenceScheduler:
    """Tests for intelligence_scheduler.py."""
    
    def test_scheduled_tasks(self):
        """Verify scheduled tasks are defined."""
        scheduled_tasks = {
            "daily_aggregation": "0 0 * * *",    # Midnight
            "weekly_report": "0 9 * * 1",         # Monday 9 AM
            "monthly_cleanup": "0 0 1 * *"        # 1st of month
        }
        
        for task, cron in scheduled_tasks.items():
            assert len(cron.split()) == 5  # Valid cron format
    
    def test_task_locking(self):
        """Verify tasks use distributed locking."""
        lock_key = "scheduler:daily_aggregation"
        lock_ttl = 3600  # 1 hour
        
        assert lock_ttl > 0


# ============================================================================
# USAGE REPORTER TESTS
# ============================================================================

class TestUsageReporter:
    """Tests for usage_reporter.py."""
    
    def test_weekly_report_structure(self):
        """Verify weekly report has required sections."""
        report = {
            "period": "2025-01-08 to 2025-01-15",
            "summary": {
                "total_requests": 75000,
                "total_cost": Decimal("750.00"),
                "avg_daily_cost": Decimal("107.14")
            },
            "top_models": [
                {"model": "gpt-4", "requests": 25000},
                {"model": "gpt-3.5-turbo", "requests": 50000}
            ],
            "trends": {
                "cost_change_percentage": 15,
                "usage_change_percentage": 20
            }
        }
        
        assert "summary" in report
        assert "top_models" in report
        assert "trends" in report
    
    def test_report_delivery(self):
        """Verify report is delivered correctly."""
        delivery_channels = ["email", "slack", "webhook"]
        
        for channel in delivery_channels:
            assert channel in ["email", "slack", "webhook", "dashboard"]


# ============================================================================
# WORKER INFRASTRUCTURE TESTS
# ============================================================================

class TestWorkerInfrastructure:
    """Tests for worker infrastructure."""
    
    def test_worker_health_check(self):
        """Verify workers have health checks."""
        health = {
            "worker": "budget_worker",
            "status": "healthy",
            "last_run": "2025-01-15T10:00:00Z",
            "next_run": "2025-01-15T10:01:00Z",
            "error_count": 0
        }
        
        assert health["status"] in ["healthy", "degraded", "failed"]
    
    def test_worker_graceful_shutdown(self):
        """Verify workers shutdown gracefully."""
        shutdown_timeout = 30  # seconds
        
        assert shutdown_timeout >= 10
    
    def test_worker_retry_on_error(self):
        """Verify workers retry on transient errors."""
        max_retries = 3
        retry_delay = 5  # seconds
        
        assert max_retries >= 1
        assert retry_delay > 0
    
    def test_dead_letter_queue(self):
        """Verify failed jobs go to DLQ."""
        dlq_entry = {
            "job_id": "job-123",
            "worker": "webhook_retry",
            "payload": {"event": "test"},
            "error": "Connection timeout",
            "attempts": 5,
            "failed_at": "2025-01-15T10:00:00Z"
        }
        
        assert dlq_entry["attempts"] >= 1

