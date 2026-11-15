"""
OpenAI Provider Adapter.

This module implements the LLMProvider interface for OpenAI's API.
Handles both non-streaming and streaming completions in OpenAI format.

Since our public API is already OpenAI-compatible, this adapter is mostly pass-through,
but it encapsulates OpenAI-specific logic (endpoints, error handling, streaming format).

MOCK MODE (SIMULATOR):
    If API key starts with 'sk-test', returns mock responses without making real API calls.
    This enables local testing without spending money or requiring real API keys.
    
    Mock responses match the exact structure expected by PricingEngine:
    - usage.prompt_tokens
    - usage.completion_tokens
    - usage.total_tokens
"""

import json
import os
import time
import uuid
from typing import AsyncGenerator, Dict, Any, Optional
from decimal import Decimal
from urllib.parse import urljoin
import httpx
import structlog

from security_utils import log_error_safe

from .base import LLMProvider, ProviderHTTPError
from .pricing import PricingEngine

log = structlog.get_logger()


# ============================================================================
# MOCK MODE CONFIGURATION
# ============================================================================

def is_mock_key(api_key: str) -> bool:
    """Check if this is a mock/test API key."""
    return api_key.startswith("sk-test")


def generate_mock_openai_response(model: str, messages: list) -> Dict[str, Any]:
    """
    Generate a mock OpenAI response for testing.
    
    Returns a properly structured response that matches OpenAI's API format,
    ensuring PricingEngine can calculate costs correctly.
    """
    # Estimate token counts based on message content
    total_input_chars = sum(len(str(m.get("content", ""))) for m in messages)
    prompt_tokens = max(10, total_input_chars // 4)  # ~4 chars per token
    completion_tokens = 15  # Fixed mock output length
    
    return {
        "id": f"chatcmpl-mock-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": f"[MOCK GPT RESPONSE] This is a simulated response for model {model}. Your request was processed successfully in mock mode."
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens
        },
        # Custom field to indicate mock mode
        "_mock": True
    }


async def generate_mock_openai_stream(model: str, messages: list) -> AsyncGenerator[str, None]:
    """
    Generate a mock OpenAI streaming response for testing.
    
    Yields SSE chunks in OpenAI format.
    """
    chunk_id = f"chatcmpl-mock-{uuid.uuid4().hex[:12]}"
    created = int(time.time())
    
    # Mock response text split into chunks
    mock_text = f"[MOCK GPT STREAM] Simulated streaming response for {model}."
    chunks = [mock_text[i:i+5] for i in range(0, len(mock_text), 5)]
    
    # Initial chunk with role
    initial_chunk = {
        "id": chunk_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]
    }
    yield f"data: {json.dumps(initial_chunk)}\n\n"
    
    # Content chunks
    for chunk_text in chunks:
        content_chunk = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"content": chunk_text}, "finish_reason": None}]
        }
        yield f"data: {json.dumps(content_chunk)}\n\n"
    
    # Final chunk
    final_chunk = {
        "id": chunk_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
    }
    yield f"data: {json.dumps(final_chunk)}\n\n"
    yield "data: [DONE]\n\n"


class OpenAIProvider(LLMProvider):
    """
    OpenAI API Provider implementation.
    
    Endpoints:
    - Non-streaming: POST https://api.openai.com/v1/chat/completions
    - Streaming: POST https://api.openai.com/v1/chat/completions (stream=true)
    
    Authentication: Bearer token in Authorization header
    """
    
    BASE_URL = "https://api.openai.com/v1"
    
    def __init__(self, api_key: str, http_client: httpx.AsyncClient, provider_name: str = "openai"):
        super().__init__(api_key, http_client, provider_name)
        self.log = log.bind(provider="openai")
        if not api_key:
            raise ValueError("OpenAI API key is missing. Set OPENAI_API_KEY or configure the provider for this organization.")
        base_raw = (os.getenv("OPENAI_API_BASE") or self.BASE_URL).rstrip("/")
        # Normalize base URL to always end with a single "/v1/"
        if base_raw.endswith("/v1"):
            base_raw = base_raw[:-3]  # remove trailing /v1
        self.base_url = f"{base_raw}/v1/"
    
    async def complete(
        self,
        model: str,
        messages: list,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Non-streaming OpenAI completion.
        
        This is a pass-through since our public API already uses OpenAI format.
        
        MOCK MODE: If API key starts with 'sk-test', returns mock response.
        """
        # =========================================================================
        # HARD MOCK: Prevent network call for test keys (MUST BE FIRST!)
        # =========================================================================
        if self.api_key and self.api_key.startswith("sk-test"):
            self.log.info("openai_hard_mock", model=model, key_prefix=self.api_key[:10])
            return {
                "id": "mock-gpt-hard",
                "object": "chat.completion",
                "created": 1234567890,
                "model": model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "HARD MOCK GPT"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}
            }
        # =========================================================================
        
        # Build request payload (OpenAI format)
        payload = {
            "model": model,
            "messages": messages,
            "stream": False
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        
        # Add any additional OpenAI-specific parameters
        for key, value in kwargs.items():
            if key not in payload:
                payload[key] = value
        
        # Make API request
        try:
            url = urljoin(self.base_url, "chat/completions")
            response = await self.http_client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                timeout=60.0  # 60 seconds for non-streaming
            )
            response.raise_for_status()
            
            result = response.json()
            
            self.log.info(
                "openai_completion_success",
                model=model,
                prompt_tokens=result.get("usage", {}).get("prompt_tokens", 0),
                completion_tokens=result.get("usage", {}).get("completion_tokens", 0)
            )
            
            return result
        
        except httpx.HTTPStatusError as e:
            # Log OpenAI error details
            error_body = e.response.text
            safe_body = log_error_safe(error_body)[:500]
            status_code = e.response.status_code
            self.log.error(
                "openai_api_error",
                status_code=status_code,
                error_body=safe_body,
                openai_request_id=e.response.headers.get("x-request-id")
            )
            raise ProviderHTTPError(
                status_code=status_code,
                provider="openai",
                message=f"OpenAI returned HTTP {status_code}",
                safe_body=safe_body
            )
        
        except Exception as e:
            self.log.error(
                "openai_request_failed",
                error_type=type(e).__name__,
                error_message=str(e)
            )
            raise
    
    async def stream(
        self,
        model: str,
        messages: list,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Streaming OpenAI completion.
        
        Yields Server-Sent Events in OpenAI format.
        
        MOCK MODE: If API key starts with 'sk-test', returns mock stream.
        """
        # MOCK MODE: Return simulated stream for test keys
        if is_mock_key(self.api_key):
            self.log.info("openai_mock_stream", model=model, key_prefix=self.api_key[:10])
            async for chunk in generate_mock_openai_stream(model, messages):
                yield chunk
            return
        
        # Build request payload
        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        
        for key, value in kwargs.items():
            if key not in payload:
                payload[key] = value
        
        # Make streaming request
        try:
            url = urljoin(self.base_url, "chat/completions")
            async with self.http_client.stream(
                "POST",
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                timeout=300.0  # 5 minutes for streaming
            ) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        # OpenAI SSE format: "data: {json}\n\n"
                        yield f"{line}\n\n"
                        
                        # Check for [DONE] marker
                        if line == "data: [DONE]":
                            break
        
        except httpx.HTTPStatusError as e:
            error_body = await e.response.aread() if hasattr(e.response, 'aread') else e.response.text
            self.log.error(
                "openai_stream_error",
                status_code=e.response.status_code,
                error_body=log_error_safe(str(error_body))[:500],
                openai_request_id=e.response.headers.get("x-request-id")
            )
            raise
        
        except Exception as e:
            self.log.error(
                "openai_stream_failed",
                error_type=type(e).__name__,
                error_message=str(e)
            )
            raise
    
    def get_pricing(self, model: str) -> Dict[str, Decimal]:
        """Get OpenAI pricing from centralized pricing engine."""
        return PricingEngine.get_pricing(model)
    
    def calculate_cost(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> Decimal:
        """Calculate cost using centralized pricing engine."""
        return PricingEngine.calculate_cost(model, prompt_tokens, completion_tokens)
    
    def get_supported_models(self) -> list[str]:
        """Get list of OpenAI models."""
        return PricingEngine.get_models_by_provider("openai")
    
    def validate_model(self, model: str) -> bool:
        """
        Validate OpenAI model name.
        
        OpenAI accepts any model name (including fine-tuned models),
        so we do a soft validation (check if in pricing table, but allow unknowns).
        """
        supported = self.get_supported_models()
        
        if model not in supported:
            self.log.warning(
                "unknown_openai_model",
                model=model,
                message="Model not in pricing table, allowing anyway (might be fine-tuned model)"
            )
        
        # Always return True for OpenAI (backward compatibility)
        return True


# Factory function for easy instantiation
def create_openai_provider(
    api_key: str,
    http_client: httpx.AsyncClient
) -> OpenAIProvider:
    """
    Factory function to create OpenAI provider instance.
    
    Args:
        api_key: OpenAI API key (starts with "sk-" or "sk-proj-")
        http_client: Async HTTP client
    
    Returns:
        OpenAIProvider instance
    """
    return OpenAIProvider(
        api_key=api_key,
        http_client=http_client,
        provider_name="openai"
    )

