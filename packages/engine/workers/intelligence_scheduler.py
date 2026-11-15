#!/usr/bin/env python3
"""
INTELLIGENCE AGGREGATOR SCHEDULER
==================================
Internal scheduler that runs intelligence aggregation at a specific time daily.

This is a persistent worker that:
1. Runs in a Docker container
2. Sleeps until the target hour (default: 2am UTC)
3. Executes intelligence_aggregator.py
4. Repeats daily

Why not cron?
- Simpler Docker deployment (no cron daemon needed)
- Better logging (structlog integration)
- Easier health checks (container restart on failure)
- Environment-aware (dev/staging/prod)

Author: Oxy contributors
License: Apache 2.0
"""

import os
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import structlog

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from workers.intelligence_aggregator import run_intelligence_aggregation

# Logging
log = structlog.get_logger()

# Configuration
RUN_MODE = os.getenv("INTELLIGENCE_RUN_MODE", "schedule")  # "once" or "schedule"
RUN_HOUR = int(os.getenv("INTELLIGENCE_RUN_HOUR", "2"))  # Default: 2am UTC
INTERVAL_SECONDS = int(os.getenv("INTELLIGENCE_INTERVAL", "86400"))  # Default: 24h


def get_next_run_time() -> datetime:
    """
    Calculate next run time based on target hour.
    
    Returns:
        datetime: Next scheduled run time in UTC
    
    Example:
        If current time is 10pm UTC and target hour is 2am:
        - Returns today at 2am if not yet passed
        - Returns tomorrow at 2am if already passed
    """
    now = datetime.now(timezone.utc)
    
    # Create datetime for today at target hour
    target = now.replace(hour=RUN_HOUR, minute=0, second=0, microsecond=0)
    
    # If target time already passed today, schedule for tomorrow
    if now >= target:
        target += timedelta(days=1)
    
    return target


def get_sleep_duration(target: datetime) -> float:
    """
    Calculate seconds to sleep until target time.
    
    Args:
        target: Target datetime in UTC
    
    Returns:
        float: Seconds to sleep (always positive)
    """
    now = datetime.now(timezone.utc)
    delta = target - now
    return max(delta.total_seconds(), 0)


async def run_once():
    """
    Run intelligence aggregation once and exit.
    
    Used for manual testing or cron-based scheduling.
    """
    log.info("intelligence_scheduler_run_once_mode")
    
    result = await run_intelligence_aggregation()
    
    if result["success"]:
        log.info("intelligence_scheduler_run_once_complete", 
                duration=result["duration_seconds"],
                insights=result["insights_generated"])
        sys.exit(0)
    else:
        log.error("intelligence_scheduler_run_once_failed", 
                 error=result.get("error"))
        sys.exit(1)


async def run_scheduled():
    """
    Run intelligence aggregation on a schedule.
    
    Infinite loop that:
    1. Calculates next run time
    2. Sleeps until then
    3. Executes aggregation
    4. Repeats
    
    Designed for long-running Docker container.
    """
    log.info("intelligence_scheduler_started",
            run_hour=RUN_HOUR,
            interval_hours=INTERVAL_SECONDS / 3600,
            mode="scheduled")
    
    while True:
        try:
            # Calculate next run time
            next_run = get_next_run_time()
            sleep_duration = get_sleep_duration(next_run)
            
            log.info("intelligence_scheduler_waiting",
                    next_run=next_run.isoformat(),
                    sleep_hours=sleep_duration / 3600)
            
            # Sleep until target time (with periodic heartbeat)
            # Wake up every hour to log heartbeat
            heartbeat_interval = 3600  # 1 hour
            elapsed = 0
            
            while elapsed < sleep_duration:
                sleep_time = min(heartbeat_interval, sleep_duration - elapsed)
                await asyncio.sleep(sleep_time)
                elapsed += sleep_time
                
                # Log heartbeat if still waiting
                if elapsed < sleep_duration:
                    remaining_hours = (sleep_duration - elapsed) / 3600
                    log.info("intelligence_scheduler_heartbeat",
                            remaining_hours=f"{remaining_hours:.1f}h",
                            next_run=next_run.isoformat())
            
            # Execute intelligence aggregation
            log.info("intelligence_scheduler_executing",
                    scheduled_time=next_run.isoformat(),
                    actual_time=datetime.now(timezone.utc).isoformat())
            
            result = await run_intelligence_aggregation()
            
            if result["success"]:
                log.info("intelligence_scheduler_execution_complete",
                        duration=result["duration_seconds"],
                        insights=result["insights_generated"],
                        next_run=(next_run + timedelta(days=1)).isoformat())
            else:
                log.error("intelligence_scheduler_execution_failed",
                         error=result.get("error"),
                         will_retry_tomorrow=True)
            
            # Small sleep before next iteration to avoid immediate re-run
            await asyncio.sleep(60)
            
        except KeyboardInterrupt:
            log.info("intelligence_scheduler_stopped", reason="SIGINT")
            break
            
        except Exception as e:
            log.error("intelligence_scheduler_error",
                     error=str(e),
                     exc_info=True,
                     will_retry=True)
            # Sleep 5 minutes before retry
            await asyncio.sleep(300)


async def main():
    """Main entry point."""
    log.info("intelligence_scheduler_initializing",
            run_mode=RUN_MODE,
            run_hour=RUN_HOUR,
            environment=os.getenv("ENVIRONMENT", "production"))
    
    # Validate configuration
    if not 0 <= RUN_HOUR <= 23:
        log.error("intelligence_scheduler_invalid_config",
                 run_hour=RUN_HOUR,
                 valid_range="0-23")
        sys.exit(1)
    
    # Check required environment variables
    if not os.getenv("SUPABASE_URL"):
        log.error("intelligence_scheduler_missing_env",
                 missing="SUPABASE_URL")
        sys.exit(1)
    
    if not os.getenv("SUPABASE_SERVICE_KEY"):
        log.error("intelligence_scheduler_missing_env",
                 missing="SUPABASE_SERVICE_KEY")
        sys.exit(1)
    
    # Run based on mode
    if RUN_MODE == "once":
        await run_once()
    else:
        await run_scheduled()


if __name__ == "__main__":
    print("🧠 Starting Intelligence Aggregator Scheduler...")
    print("=" * 70)
    print(f"   Mode: {RUN_MODE}")
    print(f"   Schedule: {RUN_HOUR}:00 UTC daily")
    print(f"   Environment: {os.getenv('ENVIRONMENT', 'production')}")
    print("=" * 70)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Scheduler stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Scheduler failed: {e}")
        sys.exit(1)

