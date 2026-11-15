"""
OXY ENGINE - REDIS LUA SCRIPTS (CLEANED)
========================================
Atomic Redis operations using Lua scripts.

DEPRECATION NOTICE:
Budget scripts (LUA_RESERVE_BUDGET, etc.) have been moved to
packages/engine/core/budget.py (BudgetManager).

This file now contains only utility scripts (rate limiting, cache clearing).
"""

# ============================================================================
# RATE LIMIT CHECK SCRIPT
# ============================================================================
LUA_RATE_LIMIT_CHECK = """
local rate_limit_key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])

-- Get current count
local current = tonumber(redis.call('GET', rate_limit_key)) or 0

-- Check if limit exceeded
if current >= limit then
    -- Get TTL for retry-after header
    local ttl = redis.call('TTL', rate_limit_key)
    if ttl < 0 then
        ttl = window_seconds
    end
    return {current, limit, ttl, 'RATE_LIMIT_EXCEEDED'}
end

-- Increment counter
local new_count = redis.call('INCR', rate_limit_key)

-- Set expiry only on first request in window
if new_count == 1 then
    redis.call('EXPIRE', rate_limit_key, window_seconds)
end

-- Get remaining TTL
local ttl = redis.call('TTL', rate_limit_key)
if ttl < 0 then
    ttl = window_seconds
end

return {new_count, limit, ttl, 'OK'}
"""

def parse_rate_limit_result(result: list) -> dict:
    """Parse result from LUA_RATE_LIMIT_CHECK script."""
    return {
        "current_count": int(result[0]),
        "limit": int(result[1]),
        "ttl_seconds": int(result[2]),
        "status": result[3].decode() if isinstance(result[3], bytes) else result[3]
    }


# ============================================================================
# ATOMIC CACHE INVALIDATION SCRIPT
# ============================================================================
LUA_CLEAR_PROJECT_CACHE = """
local project_id = ARGV[1]
local project_keys_set = 'project_keys:' .. project_id

-- SHA-256 hashes of the project's cached API keys (never the keys themselves;
-- see dependencies.api_key_cache_name)
local key_hashes = redis.call('SMEMBERS', project_keys_set)

-- Delete all key caches
local deleted_count = 0
for _, key_hash in ipairs(key_hashes) do
    local key_cache = 'api_key:' .. key_hash
    if redis.call('DEL', key_cache) == 1 then
        deleted_count = deleted_count + 1
    end
end

-- Delete project keys set
redis.call('DEL', project_keys_set)

return {deleted_count, #key_hashes, 'OK'}
"""

def parse_cache_clear_result(result: list) -> dict:
    """Parse result from LUA_CLEAR_PROJECT_CACHE script."""
    return {
        "deleted_count": int(result[0]),
        "total_keys": int(result[1]),
        "status": result[2].decode() if isinstance(result[2], bytes) else result[2]
    }

