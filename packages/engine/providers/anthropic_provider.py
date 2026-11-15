"""
Anthropic Claude API Provider Adapter.

This module implements the LLMProvider interface for Anthropic's Claude API.
Handles conversion between OpenAI format (public API) and Anthropic format (native API).

Key Features:
- OpenAI messages → Anthropic messages conversion
- Anthropic response → OpenAI response conversion
- Streaming support with SSE format conversion
- Cost calculation using centralized pricing engine

Architecture:
    Client (OpenAI format)
        ↓
    Oxy Engine (/v1/chat/completions)
        ↓
    AnthropicProvider
        ├─→ Convert: OpenAI → Anthropic
        ├─→ API Call: api.anthropic.com
        ├─→ Convert: Anthropic → OpenAI
        └─→ Return (OpenAI format)

MOCK MODE (SIMULATOR):
    If API key starts with 'sk-ant-test', returns mock responses without making real API calls.
    This enables local testing without spending money or requiring real API keys.
"""

import json
import time
import uuid
from typing import AsyncGenerator, Dict, Any, Optional, List
from decimal import Decimal
import httpx
import structlog

from .base import LLMProvider
from .pricing import PricingEngine

log = structlog.get_logger()


# ============================================================================
# MOCK MODE CONFIGURATION
# ============================================================================

def is_mock_anthropic_key(api_key: str) -> bool:
    """Check if this is a mock/test Anthropic API key."""
    return api_key.startswith("sk-ant-test")


def generate_mock_anthropic_response(model: str, messages: list) -> Dict[str, Any]:
    """
    Generate a mock Anthropic response (in OpenAI format after conversion).
    
    Returns a properly structured response that matches what _convert_response_anthropic_to_openai would return.
    """
    # Estimate token counts based on message content
    total_input_chars = sum(len(str(m.get("content", ""))) for m in messages)
    input_tokens = max(10, total_input_chars // 4)  # ~4 chars per token
    output_tokens = 15  # Fixed mock output length
    
    return {
        "id": f"chatcmpl-mock-claude-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": f"[MOCK CLAUDE RESPONSE] This is a simulated response for model {model}. Your request was processed successfully in mock mode."
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens
        },
        # Custom field to indicate mock mode
        "_mock": True
    }


async def generate_mock_anthropic_stream(model: str, messages: list) -> AsyncGenerator[str, None]:
    """
    Generate a mock Anthropic streaming response (in OpenAI format).
    
    Yields SSE chunks in OpenAI format (already converted from Anthropic).
    """
    chunk_id = f"chatcmpl-mock-claude-{uuid.uuid4().hex[:12]}"
    created = int(time.time())
    
    # Mock response text split into chunks
    mock_text = f"[MOCK CLAUDE STREAM] Simulated streaming response for {model}."
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


class AnthropicProvider(LLMProvider):
    """
    Anthropic Claude API Provider implementation.
    
    API Documentation: https://docs.anthropic.com/claude/reference/
    
    Key Differences from OpenAI:
    1. System message is a separate parameter (not in messages array)
    2. Messages must alternate user/assistant (strict turn-taking)
    3. max_tokens is REQUIRED (no default)
    4. Streaming format is slightly different (no "data: " prefix)
    5. Model names use full version (claude-3-5-sonnet-20241022)
    
    This adapter handles all these differences transparently.
    """
    
    BASE_URL = "https://api.anthropic.com/v1"
    ANTHROPIC_VERSION = "2023-06-01"  # API version header
    
    # Default max_tokens if not specified (Anthropic requires this)
    DEFAULT_MAX_TOKENS = 4096
    
    def __init__(
        self,
        api_key: str,
        http_client: httpx.AsyncClient,
        provider_name: str = "anthropic"
    ):
        super().__init__(api_key, http_client, provider_name)
        self.log = log.bind(provider="anthropic")
    
    def _extract_system_message(self, messages: List[Dict]) -> tuple[Optional[str], List[Dict]]:
        """
        Extract system message from OpenAI messages array.
        
        Anthropic expects system message as a separate parameter,
        while OpenAI includes it in the messages array.
        
        Args:
            messages: OpenAI-format messages [{"role": "system|user|assistant", "content": "..."}]
        
        Returns:
            Tuple of (system_message_text, remaining_messages)
        
        Example:
            Input: [{"role": "system", "content": "You are helpful"}, {"role": "user", "content": "Hi"}]
            Output: ("You are helpful", [{"role": "user", "content": "Hi"}])
        """
        system_message = None
        remaining_messages = []
        
        for msg in messages:
            if msg.get("role") == "system":
                # Concatenate multiple system messages if present
                if system_message is None:
                    system_message = msg.get("content", "")
                else:
                    system_message += "\n\n" + msg.get("content", "")
            else:
                remaining_messages.append(msg)
        
        return system_message, remaining_messages
    
    def _convert_messages_openai_to_anthropic(
        self,
        messages: List[Dict]
    ) -> tuple[Optional[str], List[Dict]]:
        """
        Convert OpenAI messages to Anthropic format.
        
        Key conversions:
        1. Extract system message (separate parameter in Anthropic)
        2. Ensure user/assistant alternation (Anthropic requirement)
        3. Convert content format (same structure, but validate)
        
        Args:
            messages: OpenAI-format messages
        
        Returns:
            Tuple of (system_message, anthropic_messages)
        """
        system_message, remaining_messages = self._extract_system_message(messages)
        
        # Validate alternation (Anthropic requires strict user → assistant → user)
        # If not alternating, merge consecutive messages of same role
        anthropic_messages = []
        last_role = None
        
        for msg in remaining_messages:
            role = msg.get("role")
            content = msg.get("content", "")
            
            # Skip empty messages
            if not content:
                continue
            
            # Anthropic only supports "user" and "assistant" roles
            if role not in ["user", "assistant"]:
                self.log.warning(
                    "unsupported_role",
                    role=role,
                    message="Anthropic only supports user/assistant roles, skipping"
                )
                continue
            
            # If same role as last message, merge content
            if role == last_role and anthropic_messages:
                anthropic_messages[-1]["content"] += "\n\n" + content
            else:
                anthropic_messages.append({
                    "role": role,
                    "content": content
                })
                last_role = role
        
        # Anthropic requires first message to be from user
        if anthropic_messages and anthropic_messages[0]["role"] != "user":
            self.log.warning(
                "first_message_not_user",
                first_role=anthropic_messages[0]["role"],
                message="Prepending empty user message for Anthropic compatibility"
            )
            anthropic_messages.insert(0, {
                "role": "user",
                "content": "(context)"
            })
        
        return system_message, anthropic_messages
    
    def _convert_response_anthropic_to_openai(
        self,
        anthropic_response: Dict,
        model: str
    ) -> Dict[str, Any]:
        """
        Convert Anthropic response to OpenAI format.
        
        Anthropic response structure:
        {
            "id": "msg_...",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": "Hello!"}],
            "model": "claude-3-5-sonnet-20241022",
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 10,
                "output_tokens": 20
            }
        }
        
        OpenAI response structure:
        {
            "id": "chatcmpl-...",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "claude-3-5-sonnet",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "Hello!"},
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30
            }
        }
        """
        # Extract content (Anthropic returns array, OpenAI expects string)
        content_blocks = anthropic_response.get("content", [])
        content_text = ""
        
        for block in content_blocks:
            if block.get("type") == "text":
                content_text += block.get("text", "")
        
        # Map stop_reason to finish_reason
        stop_reason_map = {
            "end_turn": "stop",
            "max_tokens": "length",
            "stop_sequence": "stop",
        }
        stop_reason = anthropic_response.get("stop_reason", "end_turn")
        finish_reason = stop_reason_map.get(stop_reason, "stop")
        
        # Extract usage
        usage = anthropic_response.get("usage", {})
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        
        # Build OpenAI-format response
        openai_response = {
            "id": f"chatcmpl-{anthropic_response.get('id', uuid.uuid4().hex[:8])}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,  # Use original model name from request
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content_text
                    },
                    "finish_reason": finish_reason
                }
            ],
            "usage": {
                "prompt_tokens": input_tokens,
                "completion_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens
            }
        }
        
        return openai_response
    
    async def complete(
        self,
        model: str,
        messages: list,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Non-streaming Anthropic completion.
        
        Converts OpenAI request → Anthropic request → Anthropic response → OpenAI response.
        
        MOCK MODE: If API key starts with 'sk-ant-test', returns mock response.
        """
        # =========================================================================
        # HARD MOCK: Prevent network call for test keys (MUST BE FIRST!)
        # =========================================================================
        if self.api_key and self.api_key.startswith("sk-ant-test"):
            self.log.info("anthropic_hard_mock", model=model, key_prefix=self.api_key[:15])
            return {
                "id": "mock-claude-hard",
                "object": "chat.completion",
                "created": 1234567890,
                "model": model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "HARD MOCK CLAUDE"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}
            }
        # =========================================================================
        
        # Convert messages
        system_message, anthropic_messages = self._convert_messages_openai_to_anthropic(messages)
        
        # Build Anthropic request payload
        payload = {
            "model": model,
            "messages": anthropic_messages,
            "max_tokens": max_tokens or self.DEFAULT_MAX_TOKENS,
        }
        
        # Add system message if present
        if system_message:
            payload["system"] = system_message
        
        # Add temperature if specified
        if temperature is not None:
            payload["temperature"] = temperature
        
        # Add other Anthropic-specific parameters
        if "top_p" in kwargs:
            payload["top_p"] = kwargs["top_p"]
        if "top_k" in kwargs:
            payload["top_k"] = kwargs["top_k"]
        if "stop_sequences" in kwargs:
            payload["stop_sequences"] = kwargs["stop_sequences"]
        
        # Make API request
        try:
            response = await self.http_client.post(
                f"{self.BASE_URL}/messages",
                json=payload,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": self.ANTHROPIC_VERSION,
                    "content-type": "application/json"
                },
                timeout=60.0  # 60 seconds for non-streaming
            )
            response.raise_for_status()
            
            anthropic_result = response.json()
            
            # Log success
            usage = anthropic_result.get("usage", {})
            self.log.info(
                "anthropic_completion_success",
                model=model,
                prompt_tokens=usage.get("input_tokens", 0),
                completion_tokens=usage.get("output_tokens", 0)
            )
            
            # Convert to OpenAI format
            return self._convert_response_anthropic_to_openai(anthropic_result, model)
        
        except httpx.HTTPStatusError as e:
            # Log Anthropic error details
            error_body = e.response.text
            self.log.error(
                "anthropic_api_error",
                status_code=e.response.status_code,
                error_body=error_body[:500]  # Truncate for logging
            )
            raise
        
        except Exception as e:
            self.log.error(
                "anthropic_request_failed",
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
        Streaming Anthropic completion.
        
        Anthropic streaming format:
            event: message_start
            data: {"type": "message_start", ...}
            
            event: content_block_delta
            data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}
            
            event: message_stop
            data: {"type": "message_stop"}
        
        OpenAI streaming format:
            data: {"id": "...", "object": "chat.completion.chunk", "choices": [{"delta": {"content": "Hello"}}]}
            ...
            data: [DONE]
        
        This method converts Anthropic → OpenAI format on-the-fly.
        
        MOCK MODE: If API key starts with 'sk-ant-test', returns mock stream.
        """
        # MOCK MODE: Return simulated stream for test keys
        if is_mock_anthropic_key(self.api_key):
            self.log.info("anthropic_mock_stream", model=model, key_prefix=self.api_key[:15])
            async for chunk in generate_mock_anthropic_stream(model, messages):
                yield chunk
            return
        
        # Convert messages
        system_message, anthropic_messages = self._convert_messages_openai_to_anthropic(messages)
        
        # Build Anthropic request payload
        payload = {
            "model": model,
            "messages": anthropic_messages,
            "max_tokens": max_tokens or self.DEFAULT_MAX_TOKENS,
            "stream": True  # Enable streaming
        }
        
        if system_message:
            payload["system"] = system_message
        
        if temperature is not None:
            payload["temperature"] = temperature
        
        # Add other parameters
        if "top_p" in kwargs:
            payload["top_p"] = kwargs["top_p"]
        if "top_k" in kwargs:
            payload["top_k"] = kwargs["top_k"]
        
        # Generate unique completion ID for this stream
        completion_id = f"chatcmpl-anthropic-{uuid.uuid4().hex[:8]}"
        created_timestamp = int(time.time())
        
        try:
            async with self.http_client.stream(
                "POST",
                f"{self.BASE_URL}/messages",
                json=payload,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": self.ANTHROPIC_VERSION,
                    "content-type": "application/json"
                },
                timeout=300.0  # 5 minutes for streaming
            ) as response:
                response.raise_for_status()
                
                # Track token usage (reported at end of stream)
                prompt_tokens = 0
                completion_tokens = 0
                
                async for line in response.aiter_lines():
                    # Anthropic uses SSE format: "event: ...\ndata: {...}"
                    if line.startswith("data: "):
                        data_json = line[6:]  # Remove "data: " prefix
                        
                        try:
                            data = json.loads(data_json)
                            event_type = data.get("type")
                            
                            # Handle different Anthropic event types
                            if event_type == "message_start":
                                # Message started - send initial chunk
                                openai_chunk = {
                                    "id": completion_id,
                                    "object": "chat.completion.chunk",
                                    "created": created_timestamp,
                                    "model": model,
                                    "choices": [
                                        {
                                            "index": 0,
                                            "delta": {"role": "assistant"},
                                            "finish_reason": None
                                        }
                                    ]
                                }
                                yield f"data: {json.dumps(openai_chunk)}\n\n"
                            
                            elif event_type == "content_block_start":
                                # Content block started (Anthropic can have multiple blocks)
                                pass  # No action needed
                            
                            elif event_type == "content_block_delta":
                                # Actual content delta (this is what we stream to client)
                                delta = data.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    text = delta.get("text", "")
                                    
                                    openai_chunk = {
                                        "id": completion_id,
                                        "object": "chat.completion.chunk",
                                        "created": created_timestamp,
                                        "model": model,
                                        "choices": [
                                            {
                                                "index": 0,
                                                "delta": {"content": text},
                                                "finish_reason": None
                                            }
                                        ]
                                    }
                                    yield f"data: {json.dumps(openai_chunk)}\n\n"
                            
                            elif event_type == "content_block_stop":
                                # Content block ended
                                pass  # No action needed
                            
                            elif event_type == "message_delta":
                                # Message metadata update (contains usage)
                                usage = data.get("usage", {})
                                if "output_tokens" in usage:
                                    completion_tokens = usage["output_tokens"]
                            
                            elif event_type == "message_stop":
                                # Message completed - send final chunk with usage
                                # Extract usage from message_start event (stored earlier)
                                openai_chunk = {
                                    "id": completion_id,
                                    "object": "chat.completion.chunk",
                                    "created": created_timestamp,
                                    "model": model,
                                    "choices": [
                                        {
                                            "index": 0,
                                            "delta": {},
                                            "finish_reason": "stop"
                                        }
                                    ],
                                    "usage": {
                                        "prompt_tokens": prompt_tokens,
                                        "completion_tokens": completion_tokens,
                                        "total_tokens": prompt_tokens + completion_tokens
                                    }
                                }
                                yield f"data: {json.dumps(openai_chunk)}\n\n"
                                
                                # Send [DONE] marker (OpenAI format)
                                yield "data: [DONE]\n\n"
                            
                            elif event_type == "error":
                                # Anthropic error during streaming
                                error_msg = data.get("error", {}).get("message", "Unknown error")
                                self.log.error("anthropic_stream_error", error=error_msg)
                                raise Exception(f"Anthropic stream error: {error_msg}")
                        
                        except json.JSONDecodeError:
                            self.log.warning("anthropic_stream_invalid_json", line=line)
                            continue
        
        except httpx.HTTPStatusError as e:
            error_body = await e.response.aread() if hasattr(e.response, 'aread') else e.response.text
            self.log.error(
                "anthropic_stream_error",
                status_code=e.response.status_code,
                error_body=str(error_body)[:500]
            )
            raise
        
        except Exception as e:
            self.log.error(
                "anthropic_stream_failed",
                error_type=type(e).__name__,
                error_message=str(e)
            )
            raise
    
    def get_pricing(self, model: str) -> Dict[str, Decimal]:
        """Get Anthropic pricing from centralized pricing engine."""
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
        """Get list of Anthropic models."""
        return PricingEngine.get_models_by_provider("anthropic")
    
    def validate_model(self, model: str) -> bool:
        """
        Validate Anthropic model name.
        
        Anthropic model names include full version (e.g., claude-3-5-sonnet-20241022).
        We also accept short names (e.g., claude-3-5-sonnet) for convenience.
        """
        supported = self.get_supported_models()
        
        # Exact match
        if model in supported:
            return True
        
        # Prefix match (e.g., "claude-3-5-sonnet" matches "claude-3-5-sonnet-20241022")
        for supported_model in supported:
            if supported_model.startswith(model):
                return True
        
        # Not found
        self.log.warning(
            "unknown_anthropic_model",
            model=model,
            message="Model not in pricing table"
        )
        return False


# Factory function for easy instantiation
def create_anthropic_provider(
    api_key: str,
    http_client: httpx.AsyncClient
) -> AnthropicProvider:
    """
    Factory function to create Anthropic provider instance.
    
    Args:
        api_key: Anthropic API key (starts with "sk-ant-")
        http_client: Async HTTP client
    
    Returns:
        AnthropicProvider instance
    """
    return AnthropicProvider(
        api_key=api_key,
        http_client=http_client,
        provider_name="anthropic"
    )

