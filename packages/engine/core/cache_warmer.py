"""
CACHE WARMING - ELIMINATE COLD STARTS
=====================================
Pre-load hot data into Redis on startup to eliminate first-request latency.

Problem:
- First request after deploy: 500ms (cold cache)
- Subsequent requests: 2ms (warm cache)
- Cold starts hurt P95 latency

Solution:
- On startup, preload frequently accessed data:
  * Hot projects (>1000 req/month)
  * Active provider API keys
  * Plan limits and tier mappings
- Parallel loading for speed (<5 seconds total)

Effect:
- Lower P95 latency right after a deploy

"""

import asyncio
from decimal import Decimal
from typing import List, Dict
import httpx

from core import log, SUPABASE_URL, SUPABASE_KEY, resources
from dependencies import get_supabase_headers
from security_utils import log_error_safe, CacheEncryption


async def get_hot_projects(http_client: httpx.AsyncClient) -> List[Dict]:
    """
    Get projects with >1000 requests in last 30 days.
    These are "hot" projects that should be cached.
    """
    try:
        # Query projects with high request volume
        response = await http_client.get(
            f"{SUPABASE_URL}/rest/v1/rpc/fn_get_hot_projects",
            headers=get_supabase_headers(),
            params={"p_min_requests": 1000},
            timeout=10.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        log_error_safe(log, "get_hot_projects_failed", e)
        return []


async def preload_project_cache(
    project_id: str,
    budget_limit: Decimal,
    http_client: httpx.AsyncClient
) -> None:
    """
    Preload a single project's data into Redis cache.
    
    Cached data:
    - Project budget and limits
    - Organization membership
    - Active API keys for project
    """
    try:
        # Set project budget in Redis
        budget_key = f"project_spend:{project_id}"
        
        # Get current spend from database
        response = await http_client.get(
            f"{SUPABASE_URL}/rest/v1/projects",
            params={
                "select": "current_spend",
                "id": f"eq.{project_id}"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        response.raise_for_status()
        
        projects = response.json()
        if projects:
            current_spend = Decimal(projects[0].get("current_spend", "0"))
            await resources.redis.set(
                budget_key,
                str(current_spend),
                ex=3600  # 1 hour TTL
            )
        
        # Preload API keys for this project
        # NOTE: We don't preload individual API keys anymore since:
        # 1. api_keys table doesn't have plaintext_key column
        # 2. Provider keys are in 'providers' table
        # 3. Cache is populated on-demand when keys are validated
        keys_response = await http_client.get(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            params={
                "select": "id,key_hash,created_by,project_id",
                "project_id": f"eq.{project_id}",
                "is_active": "eq.true"
            },
            headers=get_supabase_headers(),
            timeout=5.0
        )
        keys_response.raise_for_status()
        
        keys = keys_response.json()
        # Just log the count - actual caching happens on key validation
        log.info("api_keys_found_for_project", 
                project_id=project_id, 
                key_count=len(keys))
        
        log.info("project_cache_preloaded", project_id=project_id)
        
    except Exception as e:
        log_error_safe(log, "preload_project_cache_failed", e, project_id=project_id)


async def preload_provider_pricing() -> None:
    """
    Preload provider pricing data into memory/cache.
    This data rarely changes but is accessed on every request.
    """
    try:
        from providers.pricing import PricingEngine
        
        # Pricing data is already in-memory (Python dict)
        # But we can cache it in Redis for other services
        pricing_data = {
            "openai": PricingEngine.PRICES,
            "anthropic": {
                "claude-3-opus": (0.000015, 0.000075),
                "claude-3-sonnet": (0.000003, 0.000015),
                "claude-3-haiku": (0.00000025, 0.00000125),
            }
        }
        
        await resources.redis.setex(
            "pricing:all_providers",
            86400,  # 24 hours (pricing rarely changes)
            str(pricing_data)
        )
        
        log.info("provider_pricing_preloaded", providers=list(pricing_data.keys()))
        
    except Exception as e:
        log_error_safe(log, "preload_provider_pricing_failed", e)


async def preload_plan_limits() -> None:
    """
    Preload subscription plan limits into cache.
    Used for subscription enforcement checks.
    """
    try:
        # Keep in sync with billing.py PLAN_LIMITS
        plan_limits = {
            "free": {"projects": 1, "agents": 3, "team_members": 1},
            "starter": {"projects": 5, "agents": 10, "team_members": 3},
            "growth": {"projects": 20, "agents": 50, "team_members": 10},
            "business": {"projects": None, "agents": None, "team_members": 50},
            "enterprise": {"projects": None, "agents": None, "team_members": None}
        }
        
        await resources.redis.setex(
            "config:plan_limits",
            86400,  # 24 hours
            str(plan_limits)
        )
        
        log.info("plan_limits_preloaded", plans=list(plan_limits.keys()))
        
    except Exception as e:
        log_error_safe(log, "preload_plan_limits_failed", e)


async def warm_cache_on_startup(http_client: httpx.AsyncClient) -> None:
    """
    Main cache warming function.
    Called during FastAPI lifespan startup.
    
    Strategy:
    1. Preload plan limits (fast, <100ms)
    2. Preload pricing data (fast, <100ms)
    3. Preload hot projects in parallel (slow, 1-5 seconds)
    
    Total time: <5 seconds
    """
    log.info("cache_warming_started")
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Step 1: Preload static data (parallel)
        await asyncio.gather(
            preload_plan_limits(),
            preload_provider_pricing()
        )
        
        # Step 2: Get hot projects
        hot_projects = await get_hot_projects(http_client)
        log.info("hot_projects_identified", count=len(hot_projects))
        
        # Step 3: Preload hot projects (parallel, max 10 concurrent)
        semaphore = asyncio.Semaphore(10)
        
        async def preload_with_semaphore(project):
            async with semaphore:
                await preload_project_cache(
                    project['id'],
                    Decimal(project['budget_limit']),
                    http_client
                )
        
        await asyncio.gather(
            *[preload_with_semaphore(p) for p in hot_projects[:50]],  # Limit to top 50 projects
            return_exceptions=True
        )
        
        elapsed = asyncio.get_event_loop().time() - start_time
        log.info(
            "cache_warming_complete",
            duration_seconds=round(elapsed, 2),
            projects_preloaded=len(hot_projects[:50])
        )
        
    except Exception as e:
        log_error_safe(log, "cache_warming_failed", e)


# ============================================================================
# SQL FUNCTION FOR HOT PROJECTS QUERY
# ============================================================================
# Add this to your database migrations:
#
# CREATE OR REPLACE FUNCTION fn_get_hot_projects(p_min_requests INTEGER DEFAULT 1000)
# RETURNS TABLE (
#     id UUID,
#     name TEXT,
#     budget_limit NUMERIC,
#     request_count_30d BIGINT
# ) AS $$
# BEGIN
#     RETURN QUERY
#     SELECT 
#         p.id,
#         p.name,
#         p.budget_limit,
#         COUNT(rl.id) as request_count
#     FROM projects p
#     LEFT JOIN request_logs rl ON rl.project_id = p.id
#         AND rl.created_at > NOW() - INTERVAL '30 days'
#     GROUP BY p.id, p.name, p.budget_limit
#     HAVING COUNT(rl.id) >= p_min_requests
#     ORDER BY COUNT(rl.id) DESC
#     LIMIT 100;
# END;
# $$ LANGUAGE plpgsql SECURITY DEFINER;

