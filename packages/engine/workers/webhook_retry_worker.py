"""
WEBHOOK RETRY WORKER - STRIPE FAILURE RECOVERY
==============================================
Part of the optional Stripe module: keeps billing events from being lost
when the webhook endpoint fails.

Problem:
- Stripe retries failed webhooks for 3 days
- If our endpoint is down for 6 hours, we lose billing events PERMANENTLY
- Subscription state becomes inconsistent (user pays but system thinks they're canceled)

Solution:
- On webhook failure (500 error), store event to Redis retry queue
- Worker polls queue and retries with exponential backoff
- After max retries, alert ops team

Effect:
- Billing events survive short outages of the webhook endpoint

Architecture:
- Redis as retry queue (durable, fast)
- Exponential backoff (1min, 5min, 30min, 2h, 12h)
- Idempotency via Stripe event IDs
- Dead letter queue for manual review

"""

import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any
import structlog

import redis.asyncio as aioredis
import httpx

# Initialize fallback logger BEFORE importing from core
# This ensures log is always defined, even if core import fails
log = structlog.get_logger()

# Now import from core (this may override log with shared instance)
try:
    from core import log
    from security_utils import log_error_safe
except ImportError as e:
    # If core import fails, log with fallback logger and re-raise
    log.critical("core_import_failed", error=str(e), hint="Ensure PYTHONPATH=/app and working_dir=/app in docker-compose.yml")
    raise

# ============================================================================
# CONFIGURATION
# ============================================================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
WEBHOOK_RETRY_QUEUE = "webhook_retry_queue"
WEBHOOK_DEAD_LETTER_QUEUE = "webhook_dlq"

# ============================================================================
# RETRY CONFIGURATION
# ============================================================================
# SECURITY FIX: Explicit max retries to prevent poison message infinite loops
# After MAX_RETRIES, message is moved to DLQ and marked as 'failed'
# ============================================================================

MAX_RETRIES = 5  # CRITICAL: Hard limit to prevent poison messages

# Retry backoff schedule (in seconds) - must have MAX_RETRIES entries
RETRY_BACKOFF_SCHEDULE = [
    60,      # Attempt 1: 1 minute
    300,     # Attempt 2: 5 minutes
    1800,    # Attempt 3: 30 minutes
    7200,    # Attempt 4: 2 hours
    43200,   # Attempt 5: 12 hours
]

# Validate configuration at startup
assert len(RETRY_BACKOFF_SCHEDULE) == MAX_RETRIES, \
    f"RETRY_BACKOFF_SCHEDULE must have exactly {MAX_RETRIES} entries"

MAX_RETRY_ATTEMPTS = MAX_RETRIES  # Alias for backwards compatibility

# Internal webhook endpoint
WEBHOOK_ENDPOINT = os.getenv("INTERNAL_API_URL", "http://engine:8000") + "/billing/webhook"

# Alert threshold
ALERT_EMAIL = os.getenv("OPS_ALERT_EMAIL", "")

# ============================================================================
# WORKER FUNCTIONS
# ============================================================================

async def enqueue_failed_webhook(
    redis_client: aioredis.Redis,
    event_id: str,
    event_type: str,
    event_data: Dict[str, Any]
) -> None:
    """
    Add failed webhook to retry queue.
    
    Called by billing.py when webhook processing fails.
    
    Args:
        redis_client: Redis connection
        event_id: Stripe event ID (for idempotency)
        event_type: Stripe event type (e.g., "invoice.payment_succeeded")
        event_data: Full Stripe event data
    """
    try:
        retry_item = {
            "event_id": event_id,
            "event_type": event_type,
            "event_data": event_data,
            "attempts": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_attempt_at": None,
            "next_retry_at": datetime.now(timezone.utc).isoformat()
        }
        
        await redis_client.lpush(WEBHOOK_RETRY_QUEUE, json.dumps(retry_item))
        
        log.warn(
            "webhook_retry_enqueued",
            event_id=event_id,
            event_type=event_type,
            queue_name=WEBHOOK_RETRY_QUEUE
        )
        
    except Exception as e:
        log_error_safe(
            log,
            "webhook_retry_enqueue_failed",
            e,
            event_id=event_id,
            event_type=event_type
        )


async def process_retry_queue(redis_client: aioredis.Redis, http_client: httpx.AsyncClient) -> None:
    """
    Main worker loop: poll retry queue and reprocess failed webhooks.
    
    Runs indefinitely as a background process.
    """
    log.info("webhook_retry_worker_started", queue=WEBHOOK_RETRY_QUEUE)
    
    while True:
        try:
            # Get next item from queue (non-blocking)
            item_json = await redis_client.rpop(WEBHOOK_RETRY_QUEUE)
            
            if not item_json:
                # Queue empty, sleep and retry
                await asyncio.sleep(10)
                continue
            
            # Parse retry item
            retry_item = json.loads(item_json)
            event_id = retry_item["event_id"]
            event_type = retry_item["event_type"]
            event_data = retry_item["event_data"]
            attempts = retry_item["attempts"]
            
            # Check if ready to retry
            next_retry_at = datetime.fromisoformat(retry_item["next_retry_at"])
            if datetime.now(timezone.utc) < next_retry_at:
                # Not yet time to retry, push back to queue
                await redis_client.lpush(WEBHOOK_RETRY_QUEUE, item_json)
                await asyncio.sleep(1)
                continue
            
            # Attempt retry
            log.info(
                "webhook_retry_attempt",
                event_id=event_id,
                event_type=event_type,
                attempt=attempts + 1,
                max_retries=MAX_RETRIES
            )
            
            try:
                # Reconstruct Stripe webhook format
                webhook_payload = {
                    "id": event_id,
                    "type": event_type,
                    "data": event_data,
                    "created": int(datetime.now(timezone.utc).timestamp())
                }
                
                # Send to internal webhook endpoint
                response = await http_client.post(
                    WEBHOOK_ENDPOINT,
                    json=webhook_payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Retry": "true",
                        "X-Retry-Attempt": str(attempts + 1)
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    # Success! Remove from retry queue
                    log.info(
                        "webhook_retry_success",
                        event_id=event_id,
                        event_type=event_type,
                        attempts=attempts + 1
                    )
                    continue  # Don't re-queue
                    
                else:
                    # Still failing, schedule next retry
                    raise Exception(f"Webhook returned {response.status_code}")
                    
            except Exception as retry_error:
                # Retry failed, update retry item
                attempts += 1
                
                if attempts >= MAX_RETRIES:
                    # =========================================================
                    # CRITICAL: Max retries exhausted - mark as FAILED
                    # =========================================================
                    # This webhook has failed permanently after MAX_RETRIES attempts.
                    # It is moved to DLQ with status='failed' for manual review.
                    # DO NOT re-queue this message!
                    # =========================================================
                    
                    failed_item = {
                        **retry_item,
                        "status": "failed",  # CRITICAL: Mark as failed to prevent re-processing
                        "attempts": attempts,
                        "final_error": str(retry_error)[:500],  # Truncate for safety
                        "moved_to_dlq_at": datetime.now(timezone.utc).isoformat(),
                        "max_retries": MAX_RETRIES
                    }
                    
                    await redis_client.lpush(
                        WEBHOOK_DEAD_LETTER_QUEUE,
                        json.dumps(failed_item)
                    )
                    
                    # CRITICAL LOG: This requires immediate ops attention
                    log.critical(
                        "webhook_retry_exhausted_CRITICAL",
                        event_id=event_id,
                        event_type=event_type,
                        attempts=attempts,
                        max_retries=MAX_RETRIES,
                        error=str(retry_error)[:200],
                        dlq_queue=WEBHOOK_DEAD_LETTER_QUEUE,
                        action_required="MANUAL REVIEW REQUIRED - Webhook moved to DLQ",
                        severity="CRITICAL"
                    )
                    
                    # DO NOT re-queue - message is now in DLQ
                    continue
                    
                else:
                    # Schedule next retry with exponential backoff
                    backoff_seconds = RETRY_BACKOFF_SCHEDULE[attempts - 1]
                    next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
                    
                    retry_item["attempts"] = attempts
                    retry_item["last_attempt_at"] = datetime.now(timezone.utc).isoformat()
                    retry_item["next_retry_at"] = next_retry_at.isoformat()
                    retry_item["last_error"] = str(retry_error)
                    
                    # Push back to queue for next attempt
                    await redis_client.lpush(WEBHOOK_RETRY_QUEUE, json.dumps(retry_item))
                    
                    log.warn(
                        "webhook_retry_failed_will_retry",
                        event_id=event_id,
                        event_type=event_type,
                        attempt=attempts,
                        next_retry_in_seconds=backoff_seconds,
                        error=str(retry_error)
                    )
            
        except Exception as e:
            log_error_safe(
                log,
                "webhook_retry_worker_error",
                e
            )
            await asyncio.sleep(5)


# ============================================================================
# WORKER ENTRY POINT
# ============================================================================

async def main():
    """
    Worker entry point.
    
    Run with:
        python -m workers.webhook_retry_worker
    """
    # Initialize Redis
    redis_client = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    
    # Initialize HTTP client
    http_client = httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=10)
    )
    
    try:
        await process_retry_queue(redis_client, http_client)
    finally:
        await redis_client.close()
        await http_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())

