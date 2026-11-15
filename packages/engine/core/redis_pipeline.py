"""
REDIS PIPELINING OPTIMIZATION
==============================
Batch multiple Redis operations into a single round trip.

Effect: fewer round trips per batch operation

Before (3 round trips = 30ms):
- await redis.get("project:123")
- await redis.get("user:456")
- await redis.get("budget:123")

After (1 round trip = 10ms):
- pipeline = redis.pipeline()
- pipeline.get("project:123")
- pipeline.get("user:456")
- pipeline.get("budget:123")
- results = await pipeline.execute()

ROI: 20ms × 1M requests/month = 5.5 hours saved monthly

Author: Oxy contributors
License: Apache 2.0
"""

from typing import List, Dict, Optional, Any
import redis.asyncio as aioredis


class RedisPipeline:
    """
    Optimized Redis pipeline for batch operations.
    """
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
    
    async def mget_projects(self, project_ids: List[str]) -> Dict[str, Optional[Dict]]:
        """
        Batch fetch multiple projects.
        
        Args:
            project_ids: List of project UUIDs
            
        Returns:
            Dict mapping project_id to project data
        """
        if not project_ids:
            return {}
        
        pipeline = self.redis.pipeline()
        
        # Queue all get operations
        for project_id in project_ids:
            pipeline.get(f"project:{project_id}")
        
        # Execute batch
        results = await pipeline.execute()
        
        # Map results back to project_ids
        project_map = {}
        for project_id, result in zip(project_ids, results):
            if result:
                import json
                project_map[project_id] = json.loads(result)
            else:
                project_map[project_id] = None
        
        return project_map
    
    async def mget_budgets(self, project_ids: List[str]) -> Dict[str, float]:
        """
        Batch fetch multiple project budgets.
        
        Args:
            project_ids: List of project UUIDs
            
        Returns:
            Dict mapping project_id to budget balance
        """
        if not project_ids:
            return {}
        
        pipeline = self.redis.pipeline()
        
        # Queue all get operations
        for project_id in project_ids:
            pipeline.get(f"budget:{project_id}")
        
        # Execute batch
        results = await pipeline.execute()
        
        # Map results
        budget_map = {}
        for project_id, result in zip(project_ids, results):
            if result:
                budget_map[project_id] = float(result)
            else:
                budget_map[project_id] = 0.0
        
        return budget_map
    
    async def mset_cache(self, cache_items: Dict[str, Any], ttl: int = 3600) -> bool:
        """
        Batch set multiple cache items.
        
        Args:
            cache_items: Dict mapping keys to values
            ttl: Time-to-live in seconds (default: 1 hour)
            
        Returns:
            True if successful
        """
        if not cache_items:
            return True
        
        pipeline = self.redis.pipeline()
        
        # Queue all set operations
        for key, value in cache_items.items():
            if isinstance(value, (dict, list)):
                import json
                value = json.dumps(value)
            
            pipeline.set(key, value, ex=ttl)
        
        # Execute batch
        await pipeline.execute()
        return True
    
    async def mdel_cache(self, keys: List[str]) -> int:
        """
        Batch delete multiple cache keys.
        
        Args:
            keys: List of cache keys to delete
            
        Returns:
            Number of keys deleted
        """
        if not keys:
            return 0
        
        pipeline = self.redis.pipeline()
        
        # Queue all delete operations
        for key in keys:
            pipeline.delete(key)
        
        # Execute batch
        results = await pipeline.execute()
        return sum(results)
    
    async def batch_incr(self, counters: Dict[str, int]) -> Dict[str, int]:
        """
        Batch increment multiple counters.
        
        Args:
            counters: Dict mapping counter keys to increment amounts
            
        Returns:
            Dict mapping counter keys to new values
        """
        if not counters:
            return {}
        
        pipeline = self.redis.pipeline()
        
        # Queue all increment operations
        for key, amount in counters.items():
            pipeline.incrby(key, amount)
        
        # Execute batch
        results = await pipeline.execute()
        
        # Map results
        counter_map = {}
        for key, new_value in zip(counters.keys(), results):
            counter_map[key] = new_value
        
        return counter_map


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

async def example_batch_project_fetch(redis_client: aioredis.Redis):
    """
    Example: Fetch multiple projects in one round trip.
    """
    pipeline = RedisPipeline(redis_client)
    
    # Before: 3 round trips (30ms)
    # project1 = await redis_client.get("project:123")
    # project2 = await redis_client.get("project:456")
    # project3 = await redis_client.get("project:789")
    
    # After: 1 round trip (10ms)
    projects = await pipeline.mget_projects([
        "123", "456", "789"
    ])
    
    return projects


async def example_batch_budget_check(redis_client: aioredis.Redis):
    """
    Example: Check multiple project budgets in one round trip.
    """
    pipeline = RedisPipeline(redis_client)
    
    # Batch fetch budgets
    budgets = await pipeline.mget_budgets([
        "proj-123", "proj-456", "proj-789"
    ])
    
    # All budgets fetched in 10ms instead of 30ms
    return budgets


async def example_batch_cache_invalidation(redis_client: aioredis.Redis):
    """
    Example: Invalidate multiple cache keys in one round trip.
    """
    pipeline = RedisPipeline(redis_client)
    
    # Batch delete cache keys
    deleted_count = await pipeline.mdel_cache([
        "cache:user:123",
        "cache:project:456",
        "cache:stats:789"
    ])
    
    return deleted_count

