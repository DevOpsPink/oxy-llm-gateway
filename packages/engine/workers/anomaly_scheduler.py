#!/usr/bin/env python3
"""
ANOMALY DETECTION SCHEDULER
============================

Background worker that continuously monitors AI agents for anomalous behavior.

This is a CRITICAL security component that:
1. Runs continuously in the background
2. Checks for anomalies every N seconds (default: 60)
3. Sends alerts via webhook/email for critical issues
4. Auto-pauses agents if configured

Integration Options:
1. Run as standalone Docker container (recommended for production)
2. Run as background task in FastAPI lifespan (dev mode)
3. Import and call from main.py lifespan

License: Apache 2.0
"""

import os
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

import structlog

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Logging
log = structlog.get_logger()

# Configuration
DETECTION_INTERVAL = int(os.getenv("ANOMALY_DETECTION_INTERVAL", "60"))  # seconds
RUN_MODE = os.getenv("ANOMALY_RUN_MODE", "continuous")  # "once" or "continuous"
ENABLE_WEBHOOK_ALERTS = os.getenv("ANOMALY_WEBHOOK_ENABLED", "true").lower() == "true"
ENABLE_EMAIL_ALERTS = os.getenv("ANOMALY_EMAIL_ENABLED", "false").lower() == "true"
ENABLE_AUTO_PAUSE = os.getenv("ANOMALY_AUTO_PAUSE_ENABLED", "false").lower() == "true"


class AnomalyScheduler:
    """
    Manages the anomaly detection lifecycle.
    
    Can be used:
    1. Standalone: asyncio.run(AnomalyScheduler().run())
    2. As background task: await scheduler.start_background_task()
    3. In FastAPI lifespan: create_task(scheduler.run())
    """
    
    def __init__(self, supabase_client=None, redis_client=None):
        self.supabase = supabase_client
        self.redis = redis_client
        self.detector = None
        self._running = False
        self._task = None
        self.log = log.bind(worker="anomaly_scheduler")
    
    async def _init_clients(self):
        """Initialize database clients if not provided."""
        if self.supabase is None or self.redis is None:
            # Import from core (shared resources)
            try:
                from core import resources
                self.supabase = resources.supabase
                self.redis = resources.redis
            except ImportError:
                # Standalone mode - create own clients
                import httpx
                import aioredis
                from supabase import AsyncClient
                
                supabase_url = os.getenv("SUPABASE_URL")
                supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                
                if not supabase_url or not supabase_key:
                    raise EnvironmentError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
                
                self.supabase = await AsyncClient(supabase_url, supabase_key)
                self.redis = await aioredis.from_url(redis_url)
    
    async def _init_detector(self):
        """Initialize the anomaly detector."""
        from workers.agent_anomaly_detector import AgentAnomalyDetector
        self.detector = AgentAnomalyDetector(self.supabase, self.redis)
    
    async def run_once(self) -> dict:
        """
        Run a single detection cycle.
        
        Returns:
            dict: Result with anomalies_found, duration_ms, success
        """
        await self._init_clients()
        await self._init_detector()
        
        start_time = datetime.now(timezone.utc)
        
        try:
            await self.detector.run_detection_cycle()
            
            duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            
            return {
                "success": True,
                "duration_ms": duration_ms,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            self.log.error("anomaly_detection_failed", error=str(e)[:200])
            return {
                "success": False,
                "error": str(e)[:200],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def run(self):
        """
        Run continuous anomaly detection.
        
        This is the main loop for standalone or Docker deployment.
        """
        await self._init_clients()
        await self._init_detector()
        
        self._running = True
        cycles_completed = 0
        
        self.log.info("anomaly_scheduler_started",
                     interval_seconds=DETECTION_INTERVAL,
                     auto_pause_enabled=ENABLE_AUTO_PAUSE,
                     webhook_alerts=ENABLE_WEBHOOK_ALERTS,
                     email_alerts=ENABLE_EMAIL_ALERTS)
        
        while self._running:
            try:
                # Run detection cycle
                cycle_start = datetime.now(timezone.utc)
                await self.detector.run_detection_cycle()
                cycles_completed += 1
                
                duration_ms = int((datetime.now(timezone.utc) - cycle_start).total_seconds() * 1000)
                
                self.log.info("anomaly_detection_cycle_complete",
                             cycle_number=cycles_completed,
                             duration_ms=duration_ms,
                             next_cycle_seconds=DETECTION_INTERVAL)
                
                # Sleep until next cycle
                await asyncio.sleep(DETECTION_INTERVAL)
                
            except asyncio.CancelledError:
                self.log.info("anomaly_scheduler_cancelled")
                break
                
            except Exception as e:
                self.log.error("anomaly_detection_cycle_error",
                             error=str(e)[:200],
                             will_retry=True,
                             retry_in_seconds=DETECTION_INTERVAL)
                await asyncio.sleep(DETECTION_INTERVAL)
        
        self.log.info("anomaly_scheduler_stopped", cycles_completed=cycles_completed)
    
    async def start_background_task(self, app_task_group=None):
        """
        Start as a background task (for FastAPI integration).
        
        Args:
            app_task_group: Optional task group for management
            
        Returns:
            asyncio.Task: The background task
        """
        self._task = asyncio.create_task(self.run())
        self.log.info("anomaly_scheduler_background_task_started")
        return self._task
    
    def stop(self):
        """Signal the scheduler to stop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()


# ============================================================================
# FastAPI INTEGRATION FUNCTION
# ============================================================================

async def start_anomaly_scheduler():
    """
    Start anomaly scheduler as FastAPI background task.
    
    Call this in your lifespan startup:
    
    @asynccontextmanager
    async def lifespan(app):
        anomaly_task = await start_anomaly_scheduler()
        yield
        anomaly_task.cancel()
    """
    scheduler = AnomalyScheduler()
    task = await scheduler.start_background_task()
    return task


# ============================================================================
# API ENDPOINT FOR MANUAL TRIGGER
# ============================================================================

async def trigger_anomaly_scan(supabase_client, redis_client) -> dict:
    """
    Manually trigger an anomaly scan (for API endpoint).
    
    Usage in routes:
        @router.post("/v1/admin/anomaly-scan")
        async def manual_scan():
            return await trigger_anomaly_scan(resources.supabase, resources.redis)
    """
    scheduler = AnomalyScheduler(supabase_client, redis_client)
    return await scheduler.run_once()


# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

async def main():
    """Main entry point for standalone execution."""
    print("🛡️ Anomaly Detection Scheduler")
    print("=" * 60)
    print(f"   Mode: {RUN_MODE}")
    print(f"   Interval: {DETECTION_INTERVAL}s")
    print(f"   Auto-Pause: {ENABLE_AUTO_PAUSE}")
    print(f"   Webhook Alerts: {ENABLE_WEBHOOK_ALERTS}")
    print(f"   Email Alerts: {ENABLE_EMAIL_ALERTS}")
    print("=" * 60)
    
    scheduler = AnomalyScheduler()
    
    if RUN_MODE == "once":
        result = await scheduler.run_once()
        print(f"\n{'✅' if result['success'] else '❌'} Detection complete")
        print(f"   Duration: {result.get('duration_ms', 0)}ms")
        if not result['success']:
            print(f"   Error: {result.get('error')}")
        sys.exit(0 if result['success'] else 1)
    else:
        await scheduler.run()


if __name__ == "__main__":
    log.info("anomaly_scheduler_standalone_mode")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Scheduler stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Scheduler failed: {e}")
        sys.exit(1)

