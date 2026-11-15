"""
Redis Failover Handler
======================

CRITICAL: If Redis goes down, the entire API should gracefully degrade instead of failing.

What the request path does when Redis cannot answer (the client has timeouts):
1. API key validation → database lookup, uncached
2. Budget reservation → refused with 503: a budget that cannot be checked is not spent
3. Kill switch → the agent_sessions row in the database decides; if the
   database cannot answer either, the request is refused
4. Response caching → skipped, the request goes to the provider

This module's circuit breaker is not wired into that path.

**Usage:**
```python
from core.redis_failover import redis_with_fallback, RedisOperation
from dependencies import api_key_cache_name

# Cached API key record (named by the key's SHA-256, never the key itself)
api_key_data = await redis_with_fallback(
    operation=RedisOperation.GET_API_KEY,
    redis_func=lambda: redis_client.get(api_key_cache_name(api_key)),
    fallback_func=lambda: db_get_api_key(hash_key(api_key)),
    context={"key_prefix": api_key[:12]}
)
```
"""

import asyncio
from enum import Enum
from typing import Callable, Any, Optional, Dict
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError
import structlog

log = structlog.get_logger()

class RedisOperation(str, Enum):
    """Types of Redis operations that can fail over to database."""
    GET_API_KEY = "get_api_key"
    CHECK_BUDGET = "check_budget"
    GET_PROJECT = "get_project"
    CACHE_RESPONSE = "cache_response"
    RATE_LIMIT = "rate_limit"

class RedisFailoverManager:
    """
    Manages Redis failover logic with circuit breaker pattern.
    
    **Circuit Breaker:**
    - If Redis fails 5 times in 60 seconds → Open circuit (skip Redis, use DB)
    - After 30 seconds → Half-open (try Redis again)
    - If succeeds → Close circuit (Redis healthy again)
    """
    
    def __init__(self):
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.circuit_open = False
        self.circuit_open_at: Optional[float] = None
        
        # Configuration
        self.failure_threshold = 5  # Failures before opening circuit
        self.failure_window = 60  # seconds
        self.circuit_timeout = 30  # seconds before retrying
    
    def should_use_redis(self) -> bool:
        """Determine if Redis should be tried based on circuit state."""
        import time
        now = time.time()
        
        # If circuit is open
        if self.circuit_open:
            # Check if timeout expired → try half-open
            if now - self.circuit_open_at > self.circuit_timeout:
                log.info("redis_circuit_half_open", msg="Attempting Redis reconnect")
                self.circuit_open = False
                return True
            else:
                return False  # Still open, use fallback
        
        return True  # Circuit closed, use Redis
    
    def record_success(self):
        """Record successful Redis operation."""
        if self.circuit_open:
            log.info("redis_circuit_closed", msg="Redis recovered")
        
        self.failure_count = 0
        self.circuit_open = False
    
    def record_failure(self):
        """Record failed Redis operation and potentially open circuit."""
        import time
        now = time.time()
        
        # Reset counter if outside failure window
        if self.last_failure_time and (now - self.last_failure_time > self.failure_window):
            self.failure_count = 0
        
        self.failure_count += 1
        self.last_failure_time = now
        
        # Open circuit if threshold exceeded
        if self.failure_count >= self.failure_threshold and not self.circuit_open:
            self.circuit_open = True
            self.circuit_open_at = now
            log.error(
                "redis_circuit_opened",
                failure_count=self.failure_count,
                msg="Redis circuit breaker opened, using database fallback"
            )

# Global instance
failover_manager = RedisFailoverManager()

async def redis_with_fallback(
    operation: RedisOperation,
    redis_func: Callable,
    fallback_func: Callable,
    context: Optional[Dict[str, Any]] = None,
    skip_fallback: bool = False
) -> Any:
    """
    Execute a Redis operation with automatic fallback to database.
    
    Args:
        operation: Type of operation (for logging)
        redis_func: Async function that performs Redis operation
        fallback_func: Async function that performs database fallback
        context: Additional context for logging
        skip_fallback: If True, raise exception instead of falling back (for non-critical ops)
    
    Returns:
        Result from either Redis or fallback function
    
    Raises:
        Exception: If Redis fails and skip_fallback=True
    """
    context = context or {}
    
    # Check circuit breaker
    if not failover_manager.should_use_redis():
        log.warning(
            "redis_circuit_open_using_fallback",
            operation=operation.value,
            **context
        )
        return await fallback_func()
    
    # Try Redis first
    try:
        result = await redis_func()
        failover_manager.record_success()
        return result
    
    except (RedisError, RedisConnectionError, ConnectionRefusedError, OSError) as e:
        # Log the failure
        log.error(
            "redis_operation_failed",
            operation=operation.value,
            error=str(e)[:200],
            error_type=type(e).__name__,
            **context
        )
        
        # Record failure for circuit breaker
        failover_manager.record_failure()
        
        # If skip_fallback, re-raise
        if skip_fallback:
            raise
        
        # Otherwise, fall back to database
        log.info(
            "redis_fallback_to_database",
            operation=operation.value,
            **context
        )
        
        try:
            result = await fallback_func()
            log.info(
                "redis_fallback_success",
                operation=operation.value,
                **context
            )
            return result
        except Exception as fallback_error:
            log.error(
                "redis_fallback_failed",
                operation=operation.value,
                fallback_error=str(fallback_error)[:200],
                **context
            )
            raise  # Re-raise fallback error if that also fails

def redis_optional(default_value: Any = None):
    """
    Decorator for non-critical Redis operations that can silently fail.
    
    Example: Response caching (nice to have, not critical)
    
    Usage:
    ```python
    @redis_optional(default_value=None)
    async def cache_response(key, value):
        await redis_client.set(key, value, ex=300)
    ```
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except (RedisError, RedisConnectionError, ConnectionRefusedError, OSError) as e:
                log.warning(
                    "redis_optional_operation_failed",
                    function=func.__name__,
                    error=str(e)[:100],
                    msg="Non-critical Redis operation failed, continuing"
                )
                return default_value
        return wrapper
    return decorator

