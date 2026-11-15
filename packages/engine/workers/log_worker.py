import os
import json
import asyncio
import signal
import structlog
import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)
log = structlog.get_logger()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # MUST use service role key
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
LOG_QUEUE_NAME = "log_queue:request_logs"
BATCH_SIZE = 50  # Write to DB every 50 logs
BATCH_TIMEOUT = 10 # OR write to DB every 10 seconds

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    log.critical("worker_startup_failed", error="Missing SUPABASE vars")
    exit(1)

async def main():
    redis_client = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    http_client = httpx.AsyncClient(timeout=30.0)
    
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal" # Don't return the inserted rows, saves bandwidth
    }

    # Graceful shutdown handling
    shutdown_event = asyncio.Event()
    
    def signal_handler():
        log.info("shutdown_signal_received", worker="log")
        shutdown_event.set()
    
    # Register signal handlers for graceful shutdown
    if hasattr(signal, 'SIGTERM'):
        loop = asyncio.get_event_loop()
        loop.add_signal_handler(signal.SIGTERM, signal_handler)
        loop.add_signal_handler(signal.SIGINT, signal_handler)

    log.info("log_worker_started", batch_size=BATCH_SIZE)

    try:
        while not shutdown_event.is_set():
            logs_batch = []
            
            # Try to collect a batch
            try:
                # We use a simple loop with timeout instead of BLPOP inside loop 
                # to ensure we respect the time window even if queue is slow
                start_time = asyncio.get_event_loop().time()
                
                while len(logs_batch) < BATCH_SIZE:
                    # Calculate remaining time
                    elapsed = asyncio.get_event_loop().time() - start_time
                    remaining = BATCH_TIMEOUT - elapsed
                    
                    if remaining <= 0 or shutdown_event.is_set():
                        break
                    
                    # Wait for data (blocking pop with small timeout)
                    # blpop returns tuple (key, value) or None
                    timeout = min(int(remaining) or 1, 1)  # Max 1 second to check shutdown
                    item = await redis_client.blpop(LOG_QUEUE_NAME, timeout=timeout)
                    
                    if item:
                        logs_batch.append(json.loads(item[1]))
                    
            except Exception as e:
                log.error("redis_read_error", error=str(e))
                await asyncio.sleep(1)

            # If we have data, persist it
            if logs_batch:
                try:
                    res = await http_client.post(
                        f"{SUPABASE_URL}/rest/v1/request_logs",
                        headers=headers,
                        json=logs_batch
                    )
                    res.raise_for_status()
                    log.info("logs_persisted", count=len(logs_batch))
                except Exception as e:
                    log.error("db_write_failed", error=str(e), count=len(logs_batch))
                    # Strategy: Push back to Redis? Or Dump to file?
                    # For MVP: Log error. In Prod: Dead Letter Queue.
                    # We will just re-queue them to the HEAD of the list to try again
                    for log_entry in reversed(logs_batch):
                        await redis_client.lpush(LOG_QUEUE_NAME, json.dumps(log_entry))
                    await asyncio.sleep(5) # Backoff
                    
                    # Check for shutdown after backoff
                    if shutdown_event.is_set():
                        break

    except asyncio.CancelledError:
        log.info("worker_stopping", reason="cancelled")
    except Exception as e:
        log.error("worker_fatal_error", error=str(e), exc_info=True)
    finally:
        # Process any remaining logs in queue before shutdown
        log.info("log_worker_shutting_down", message="Processing remaining logs...")
        remaining_logs = []
        try:
            while True:
                item = await redis_client.blpop(LOG_QUEUE_NAME, timeout=0.1)
                if not item:
                    break
                remaining_logs.append(json.loads(item[1]))
        except Exception:
            pass
        
        if remaining_logs:
            try:
                await http_client.post(
                    f"{SUPABASE_URL}/rest/v1/request_logs",
                    headers=headers,
                    json=remaining_logs
                )
                log.info("remaining_logs_persisted", count=len(remaining_logs))
            except Exception as e:
                log.error("failed_to_persist_remaining_logs", error=str(e), count=len(remaining_logs))
        
        await http_client.aclose()
        await redis_client.aclose()
        log.info("log_worker_stopped")

if __name__ == "__main__":
    asyncio.run(main())