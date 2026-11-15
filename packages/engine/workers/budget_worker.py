import os
import asyncio
import signal
import uuid
import structlog
import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)
log = structlog.get_logger()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
# Mirror spend counters to Postgres every 60 seconds (the proofs shorten it).
SYNC_INTERVAL = float(os.getenv("BUDGET_SYNC_INTERVAL_SECONDS", "60"))

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    log.critical("worker_startup_failed", error="Missing SUPABASE vars")
    exit(1)

async def main():
    redis_client = aioredis.from_url(
        REDIS_URL, encoding="utf-8", decode_responses=True,
        socket_timeout=5.0, socket_connect_timeout=5.0,
    )
    http_client = httpx.AsyncClient(timeout=30.0)
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }

    # Graceful shutdown handling
    shutdown_event = asyncio.Event()
    
    def signal_handler():
        log.info("shutdown_signal_received", worker="budget")
        shutdown_event.set()
    
    # Register signal handlers for graceful shutdown
    if hasattr(signal, 'SIGTERM'):
        loop = asyncio.get_event_loop()
        loop.add_signal_handler(signal.SIGTERM, signal_handler)
        loop.add_signal_handler(signal.SIGINT, signal_handler)

    log.info("budget_worker_started", sync_interval=SYNC_INTERVAL)

    try:
        # project_spend:{project_id} in Redis is the project's total spend and the
        # budget's ledger: reservations are checked against it atomically. This
        # worker copies it to projects.current_spend (the dashboard's figure, and
        # what the engine seeds the counter from if Redis loses it). It never moves
        # or deletes the counter: the old GETDEL here reset every project's spend
        # to zero once a minute, so a budget held only within one minute.
        last_mirrored: dict[str, str] = {}
        while not shutdown_event.is_set():
            cursor = 0
            while True:
                cursor, keys = await redis_client.scan(cursor=cursor, match="project_spend:*", count=100)
                for key in keys:
                    project_id = key.split(":", 1)[1] if key.startswith("project_spend:") else ""
                    if not project_id:
                        log.warn("invalid_budget_key_format", key=key)
                        continue
                    try:
                        spend = await redis_client.get(key)
                        if spend is None or last_mirrored.get(project_id) == spend:
                            continue
                        res = await http_client.post(
                            f"{SUPABASE_URL}/rest/v1/rpc/fn_mirror_spend",
                            headers=headers,
                            json={"p_project_id": project_id, "p_spend": str(spend)},
                        )
                        res.raise_for_status()
                        last_mirrored[project_id] = spend
                        log.info("budget_mirrored", project_id=project_id, spend=spend)
                    except Exception as e:
                        log.error("budget_mirror_failed", project_id=project_id, error=str(e)[:200])
                if int(cursor) == 0:
                    break
            
            # Sleep before next full sync cycle, but check for shutdown
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=SYNC_INTERVAL)
                break  # Shutdown signal received
            except asyncio.TimeoutError:
                pass  # Continue to next cycle

    except asyncio.CancelledError:
        log.info("worker_stopping", reason="cancelled")
    except Exception as e:
        log.error("worker_fatal_error", error=str(e), exc_info=True)
    finally:
        log.info("budget_worker_shutting_down", message="Closing connections...")
        await http_client.aclose()
        await redis_client.aclose()
        log.info("budget_worker_stopped")

if __name__ == "__main__":
    asyncio.run(main())