"""
Response Caching System
=======================

GOAL: Reduce OpenAI/Anthropic/Google API costs by caching identical requests.

**Business Impact (illustrative only, not guaranteed):**
- Potential savings on repeated, identical requests (workload-dependent)
- Example: repeated prompts can reduce effective spend when cache hits occur
- No formal guarantee; results vary by traffic mix

**Caching Strategy:**
1. Only cache deterministic requests (temperature=0, no streaming)
2. Cache key = SHA-256(provider + model + system_prompt + user_prompt + params)
3. TTL = 7 days (balance freshness vs cost savings)
4. Store compressed (gzip) to reduce Redis memory

**Safety:**
- Never cache creative requests (temperature > 0)
- Never cache streaming responses
- Cache misses have zero performance penalty
- Cache failures degrade gracefully (just skip cache)

**Redis Structure:**
```
response_cache:{hash} = {
    "response": {...},
    "cached_at": "2025-11-22T10:00:00Z",
    "provider": "openai",
    "model": "gpt-4"
}
TTL: 7 days
```
"""

import hashlib
import json
import gzip
import base64
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import structlog

log = structlog.get_logger()

# Cache configuration
RESPONSE_CACHE_TTL = 7 * 24 * 60 * 60  # 7 days
RESPONSE_CACHE_PREFIX = "response_cache:"

class ResponseCache:
    """
    Manages response caching for AI provider requests.
    
    **Key Features:**
    - Deterministic-only caching (temperature=0)
    - Compression to save Redis memory
    - Graceful degradation on cache failures
    - Detailed metrics for cost tracking
    """
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.log = log
    
    def _should_cache(self, request_params: Dict[str, Any]) -> bool:
        """
        Determine if a request should be cached.
        
        Rules:
        - temperature must be 0 (deterministic)
        - stream must be false
        - model must not be blacklisted (e.g., image models)
        """
        temperature = request_params.get('temperature', 1.0)
        stream = request_params.get('stream', False)
        model = request_params.get('model', '')
        
        # Don't cache creative requests
        if temperature != 0:
            return False
        
        # Don't cache streaming
        if stream:
            return False
        
        # Don't cache image/audio models (high variance)
        if any(x in model.lower() for x in ['dall-e', 'whisper', 'tts', 'vision']):
            return False
        
        return True
    
    def _generate_cache_key(
        self,
        provider: str,
        model: str,
        messages: list,
        params: Dict[str, Any]
    ) -> str:
        """
        Generate a unique cache key for this request.
        
        **Components:**
        - provider (openai/anthropic/google)
        - model (gpt-4, claude-3, gemini-pro)
        - messages (entire conversation)
        - params (max_tokens, top_p, etc.)
        
        **Output:** SHA-256 hash (64 chars)
        """
        # Normalize params (remove non-deterministic keys)
        normalized_params = {
            k: v for k, v in params.items()
            if k not in ['stream', 'user', 'metadata', 'timeout']
        }
        
        # Create deterministic string
        cache_input = json.dumps({
            'provider': provider,
            'model': model,
            'messages': messages,
            'params': normalized_params
        }, sort_keys=True)
        
        # Hash it
        cache_hash = hashlib.sha256(cache_input.encode()).hexdigest()
        return f"{RESPONSE_CACHE_PREFIX}{cache_hash}"
    
    def _compress_response(self, response: Dict[str, Any]) -> str:
        """Compress response data using gzip + base64."""
        json_bytes = json.dumps(response).encode('utf-8')
        compressed = gzip.compress(json_bytes, compresslevel=6)
        return base64.b64encode(compressed).decode('ascii')
    
    def _decompress_response(self, compressed_data: str) -> Dict[str, Any]:
        """Decompress response data."""
        compressed_bytes = base64.b64decode(compressed_data.encode('ascii'))
        json_bytes = gzip.decompress(compressed_bytes)
        return json.loads(json_bytes.decode('utf-8'))
    
    async def get_cached_response(
        self,
        provider: str,
        model: str,
        messages: list,
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Try to retrieve a cached response.
        
        Returns:
            Dict if cache hit, None if miss or error
        """
        # Check if request is cacheable
        if not self._should_cache(params):
            return None
        
        cache_key = self._generate_cache_key(provider, model, messages, params)
        
        try:
            cached_data = await self.redis.get(cache_key)
            
            if cached_data:
                # Decompress and return
                response_data = self._decompress_response(cached_data)
                
                self.log.info(
                    "response_cache_hit",
                    provider=provider,
                    model=model,
                    cached_at=response_data.get('cached_at'),
                    msg="Serving cached response"
                )
                
                return response_data.get('response')
            else:
                self.log.debug("response_cache_miss", provider=provider, model=model)
                return None
        
        except Exception as e:
            # Cache failure shouldn't break the request
            self.log.warning(
                "response_cache_get_error",
                error=str(e)[:100],
                msg="Cache retrieval failed, continuing without cache"
            )
            return None
    
    async def set_cached_response(
        self,
        provider: str,
        model: str,
        messages: list,
        params: Dict[str, Any],
        response: Dict[str, Any],
        estimated_cost: float
    ):
        """
        Store a response in cache.
        
        Args:
            estimated_cost: Estimated cost of this request (for metrics)
        """
        # Check if request is cacheable
        if not self._should_cache(params):
            return
        
        cache_key = self._generate_cache_key(provider, model, messages, params)
        
        try:
            # Prepare cache data
            cache_data = {
                'response': response,
                'cached_at': datetime.now(timezone.utc).isoformat(),
                'provider': provider,
                'model': model,
                'estimated_cost': estimated_cost
            }
            
            # Compress and store
            compressed = self._compress_response(cache_data)
            await self.redis.set(cache_key, compressed, ex=RESPONSE_CACHE_TTL)
            
            self.log.info(
                "response_cached",
                provider=provider,
                model=model,
                estimated_cost=estimated_cost,
                ttl_days=RESPONSE_CACHE_TTL // 86400,
                compressed_size_kb=len(compressed) / 1024
            )
        
        except Exception as e:
            # Cache failure shouldn't break the request
            self.log.warning(
                "response_cache_set_error",
                error=str(e)[:100],
                msg="Failed to cache response, continuing"
            )
    
    async def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics for monitoring.
        
        Returns:
            {
                "total_keys": 1234,
                "estimated_memory_mb": 45
            }
        """
        try:
            # Count keys matching pattern
            keys = await self.redis.keys(f"{RESPONSE_CACHE_PREFIX}*")
            total_keys = len(keys) if keys else 0
            
            # Estimate memory (rough)
            estimated_memory_mb = total_keys * 2  # Assume 2KB per cached response
            
            return {
                "total_keys": total_keys,
                "estimated_memory_mb": estimated_memory_mb
            }
        except Exception as e:
            self.log.error("cache_stats_error", error=str(e))
            return {"total_keys": 0, "estimated_memory_mb": 0}

