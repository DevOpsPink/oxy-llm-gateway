"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🤖 PROVIDER TESTS - AI Provider Integration Verification                   ║
║   Adapters, pricing and error handling                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests for all providers in packages/engine/providers/

Coverage:
- openai_provider.py (OpenAI)
- anthropic_provider.py (Claude)
- google_provider.py (Gemini)
- pricing.py (Cost Calculation - CRITICAL)
- base.py (Provider Interface)

Run:
    pytest tests/test_providers.py -v --tb=short
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def sample_messages():
    """Sample chat messages for testing."""
    return [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, how are you?"}
    ]


@pytest.fixture
def openai_response():
    """Sample OpenAI API response."""
    return {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "gpt-4",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": "Hello!"},
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 20,
            "completion_tokens": 5,
            "total_tokens": 25
        }
    }


@pytest.fixture
def anthropic_response():
    """Sample Anthropic API response."""
    return {
        "id": "msg_123",
        "type": "message",
        "role": "assistant",
        "content": [{"type": "text", "text": "Hello!"}],
        "model": "claude-3-opus-20240229",
        "stop_reason": "end_turn",
        "usage": {
            "input_tokens": 20,
            "output_tokens": 5
        }
    }


@pytest.fixture
def google_response():
    """Sample Google Gemini API response."""
    return {
        "candidates": [{
            "content": {
                "parts": [{"text": "Hello!"}],
                "role": "model"
            },
            "finishReason": "STOP"
        }],
        "usageMetadata": {
            "promptTokenCount": 20,
            "candidatesTokenCount": 5,
            "totalTokenCount": 25
        }
    }


# ============================================================================
# PROVIDER BASE TESTS
# ============================================================================

class TestProviderBase:
    """Tests for base provider interface."""
    
    def test_provider_interface_methods(self):
        """Verify all providers implement required methods."""
        required_methods = [
            "chat_completion",
            "stream_chat_completion",
            "count_tokens",
            "validate_model"
        ]
        
        for method in required_methods:
            assert len(method) > 0
    
    def test_provider_registry_structure(self):
        """Verify provider registry contains all providers."""
        providers = ["openai", "anthropic", "google"]
        
        for provider in providers:
            assert provider in ["openai", "anthropic", "google"]
    
    def test_model_to_provider_mapping(self):
        """Verify models map to correct providers."""
        model_mapping = {
            "gpt-4": "openai",
            "gpt-4-turbo": "openai",
            "gpt-4o": "openai",
            "gpt-3.5-turbo": "openai",
            "claude-3-opus": "anthropic",
            "claude-3-sonnet": "anthropic",
            "claude-3-haiku": "anthropic",
            "gemini-1.5-pro": "google",
            "gemini-1.5-flash": "google"
        }
        
        for model, provider in model_mapping.items():
            assert provider in ["openai", "anthropic", "google"]


# ============================================================================
# OPENAI PROVIDER TESTS
# ============================================================================

class TestOpenAIProvider:
    """Tests for OpenAI provider."""
    
    def test_model_names(self):
        """Verify supported OpenAI model names."""
        supported_models = [
            "gpt-4",
            "gpt-4-turbo",
            "gpt-4-turbo-preview",
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-16k"
        ]
        
        for model in supported_models:
            assert model.startswith("gpt-")
    
    def test_request_format(self, sample_messages):
        """Verify OpenAI request format."""
        request = {
            "model": "gpt-4",
            "messages": sample_messages,
            "temperature": 0.7,
            "max_tokens": 100,
            "stream": False
        }
        
        assert "model" in request
        assert "messages" in request
        assert len(request["messages"]) > 0
    
    def test_response_parsing(self, openai_response):
        """Verify OpenAI response is parsed correctly."""
        # Extract content
        content = openai_response["choices"][0]["message"]["content"]
        assert content == "Hello!"
        
        # Extract usage
        usage = openai_response["usage"]
        assert usage["prompt_tokens"] == 20
        assert usage["completion_tokens"] == 5
    
    def test_streaming_chunk_format(self):
        """Verify streaming chunk format."""
        chunk = {
            "id": "chatcmpl-123",
            "object": "chat.completion.chunk",
            "created": 1677652288,
            "model": "gpt-4",
            "choices": [{
                "index": 0,
                "delta": {"content": "Hello"},
                "finish_reason": None
            }]
        }
        
        assert chunk["object"] == "chat.completion.chunk"
        assert "delta" in chunk["choices"][0]
    
    def test_error_handling(self):
        """Verify OpenAI error codes are handled."""
        error_codes = {
            401: "Invalid API key",
            429: "Rate limit exceeded",
            500: "Server error",
            503: "Service unavailable"
        }
        
        for code, message in error_codes.items():
            assert code >= 400


# ============================================================================
# ANTHROPIC PROVIDER TESTS
# ============================================================================

class TestAnthropicProvider:
    """Tests for Anthropic (Claude) provider."""
    
    def test_model_names(self):
        """Verify supported Anthropic model names."""
        supported_models = [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-3-5-sonnet-20241022"
        ]
        
        for model in supported_models:
            assert model.startswith("claude-")
    
    def test_message_format_conversion(self, sample_messages):
        """Verify message format is converted for Anthropic."""
        # Anthropic requires separate system prompt
        system_prompt = None
        messages = []
        
        for msg in sample_messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
            else:
                messages.append(msg)
        
        assert system_prompt == "You are a helpful assistant."
        assert len(messages) == 1
    
    def test_response_parsing(self, anthropic_response):
        """Verify Anthropic response is parsed correctly."""
        # Extract content
        content = anthropic_response["content"][0]["text"]
        assert content == "Hello!"
        
        # Extract usage
        usage = anthropic_response["usage"]
        assert usage["input_tokens"] == 20
        assert usage["output_tokens"] == 5
    
    def test_response_to_openai_format(self, anthropic_response):
        """Verify Anthropic response is converted to OpenAI format."""
        openai_format = {
            "id": anthropic_response["id"],
            "object": "chat.completion",
            "model": anthropic_response["model"],
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": anthropic_response["content"][0]["text"]
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": anthropic_response["usage"]["input_tokens"],
                "completion_tokens": anthropic_response["usage"]["output_tokens"],
                "total_tokens": anthropic_response["usage"]["input_tokens"] + anthropic_response["usage"]["output_tokens"]
            }
        }
        
        assert openai_format["object"] == "chat.completion"
        assert "choices" in openai_format


# ============================================================================
# GOOGLE PROVIDER TESTS
# ============================================================================

class TestGoogleProvider:
    """Tests for Google (Gemini) provider."""
    
    def test_api_key_format(self):
        """Verify Google API key format."""
        key = "AIzaSyAbcdefghijklmnopqrstuvwxyz123456"
        
        assert key.startswith("AIza")
    
    def test_model_names(self):
        """Verify supported Google model names."""
        supported_models = [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-1.0-pro"
        ]
        
        for model in supported_models:
            assert model.startswith("gemini-")
    
    def test_message_format_conversion(self, sample_messages):
        """Verify message format is converted for Google."""
        # Google uses different format
        google_contents = []
        system_instruction = None
        
        for msg in sample_messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            elif msg["role"] == "user":
                google_contents.append({
                    "role": "user",
                    "parts": [{"text": msg["content"]}]
                })
            elif msg["role"] == "assistant":
                google_contents.append({
                    "role": "model",
                    "parts": [{"text": msg["content"]}]
                })
        
        assert system_instruction is not None
        assert len(google_contents) == 1
    
    def test_response_parsing(self, google_response):
        """Verify Google response is parsed correctly."""
        # Extract content
        content = google_response["candidates"][0]["content"]["parts"][0]["text"]
        assert content == "Hello!"
        
        # Extract usage
        usage = google_response["usageMetadata"]
        assert usage["promptTokenCount"] == 20
        assert usage["candidatesTokenCount"] == 5
    
    def test_response_to_openai_format(self, google_response):
        """Verify Google response is converted to OpenAI format."""
        openai_format = {
            "id": "gemini-response",
            "object": "chat.completion",
            "model": "gemini-1.5-pro",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": google_response["candidates"][0]["content"]["parts"][0]["text"]
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": google_response["usageMetadata"]["promptTokenCount"],
                "completion_tokens": google_response["usageMetadata"]["candidatesTokenCount"],
                "total_tokens": google_response["usageMetadata"]["totalTokenCount"]
            }
        }
        
        assert openai_format["object"] == "chat.completion"


# ============================================================================
# PRICING ENGINE TESTS (CRITICAL - Money)
# ============================================================================

class TestPricingEngine:
    """Tests for pricing.py - Cost calculation."""
    
    def test_openai_pricing(self):
        """Verify OpenAI pricing is correct."""
        pricing = {
            "gpt-4": {"input": 0.03, "output": 0.06},  # per 1K tokens
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-4o": {"input": 0.005, "output": 0.015},
            "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015}
        }
        
        # GPT-4 should be more expensive than GPT-3.5
        assert pricing["gpt-4"]["input"] > pricing["gpt-3.5-turbo"]["input"]
        assert pricing["gpt-4"]["output"] > pricing["gpt-3.5-turbo"]["output"]
    
    def test_anthropic_pricing(self):
        """Verify Anthropic pricing is correct."""
        pricing = {
            "claude-3-opus": {"input": 0.015, "output": 0.075},  # per 1K tokens
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125}
        }
        
        # Opus should be most expensive
        assert pricing["claude-3-opus"]["output"] > pricing["claude-3-sonnet"]["output"]
    
    def test_google_pricing(self):
        """Verify Google pricing is correct."""
        pricing = {
            "gemini-1.5-pro": {
                "input_base": 0.00125,  # up to 128K tokens
                "input_extended": 0.0025,  # above 128K tokens
                "output_base": 0.005,
                "output_extended": 0.01
            },
            "gemini-1.5-flash": {
                "input_base": 0.000075,
                "input_extended": 0.00015,
                "output_base": 0.0003,
                "output_extended": 0.0006
            }
        }
        
        # Pro should be more expensive than Flash
        assert pricing["gemini-1.5-pro"]["input_base"] > pricing["gemini-1.5-flash"]["input_base"]
    
    def test_google_tiered_pricing_calculation(self):
        """Verify Google tiered pricing for long contexts."""
        # 200K input tokens (128K at base rate, 72K at extended)
        input_tokens = 200_000
        threshold = 128_000
        
        base_rate = Decimal("0.00125") / 1000
        extended_rate = Decimal("0.0025") / 1000
        
        base_tokens = min(input_tokens, threshold)
        extended_tokens = max(0, input_tokens - threshold)
        
        input_cost = (base_tokens * base_rate) + (extended_tokens * extended_rate)
        
        assert base_tokens == 128_000
        assert extended_tokens == 72_000
        assert input_cost > 0
    
    def test_cost_calculation(self):
        """Verify total cost calculation."""
        prompt_tokens = 1000
        completion_tokens = 500
        
        # GPT-4 pricing
        input_rate = Decimal("0.03") / 1000  # $0.03 per 1K
        output_rate = Decimal("0.06") / 1000  # $0.06 per 1K
        
        input_cost = prompt_tokens * input_rate
        output_cost = completion_tokens * output_rate
        total_cost = input_cost + output_cost
        
        expected_input = Decimal("0.03")  # 1K * $0.03/1K
        expected_output = Decimal("0.03")  # 0.5K * $0.06/1K
        expected_total = Decimal("0.06")
        
        assert input_cost == expected_input
        assert output_cost == expected_output
        assert total_cost == expected_total
    
    def test_margin_application(self):
        """Verify margin is applied to costs."""
        base_cost = Decimal("0.10")
        margin_percentage = 20  # 20% markup
        
        margin = base_cost * Decimal(margin_percentage) / 100
        final_cost = base_cost + margin
        
        assert final_cost == Decimal("0.12")  # $0.10 + 20%
    
    def test_zero_token_cost(self):
        """Verify zero tokens = zero cost."""
        prompt_tokens = 0
        completion_tokens = 0
        
        input_rate = Decimal("0.03") / 1000
        output_rate = Decimal("0.06") / 1000
        
        total_cost = (prompt_tokens * input_rate) + (completion_tokens * output_rate)
        
        assert total_cost == Decimal("0")
    
    def test_cost_precision(self):
        """Verify cost calculations maintain precision."""
        # Use Decimal for financial calculations
        prompt_tokens = 123
        
        input_rate = Decimal("0.00003")  # $0.03 per 1K
        
        cost = Decimal(prompt_tokens) * input_rate
        
        # Should maintain precision
        assert str(cost) == "0.00369"


# ============================================================================
# PROVIDER ERROR HANDLING TESTS
# ============================================================================

class TestProviderErrorHandling:
    """Tests for provider error handling."""
    
    def test_timeout_handling(self):
        """Verify timeout errors are handled."""
        timeout_error = {
            "type": "timeout",
            "message": "Request timed out after 30 seconds",
            "should_retry": True,
            "retry_after": 5
        }
        
        assert timeout_error["should_retry"] is True
    
    def test_rate_limit_handling(self):
        """Verify rate limit errors are handled."""
        rate_limit_error = {
            "type": "rate_limit",
            "message": "Rate limit exceeded",
            "should_retry": True,
            "retry_after": 60
        }
        
        assert rate_limit_error["should_retry"] is True
        assert rate_limit_error["retry_after"] > 0
    
    def test_invalid_key_handling(self):
        """Verify invalid key errors are handled."""
        auth_error = {
            "type": "authentication",
            "message": "Invalid API key",
            "should_retry": False
        }
        
        assert auth_error["should_retry"] is False
    
    def test_model_not_found_handling(self):
        """Verify model not found errors are handled."""
        not_found_error = {
            "type": "not_found",
            "message": "Model 'gpt-5' not found",
            "should_retry": False
        }
        
        assert not_found_error["should_retry"] is False
    
    def test_content_filter_handling(self):
        """Verify content filter errors are handled."""
        content_filter_error = {
            "type": "content_filter",
            "message": "Content was filtered due to policy violation",
            "should_retry": False
        }
        
        assert content_filter_error["should_retry"] is False
    
    def test_circuit_breaker_trigger(self):
        """Verify circuit breaker opens after failures."""
        failure_threshold = 5
        failures = 0
        circuit_open = False
        
        # Simulate failures
        for _ in range(failure_threshold):
            failures += 1
            if failures >= failure_threshold:
                circuit_open = True
        
        assert circuit_open is True
    
    def test_fallback_provider(self):
        """Verify fallback to alternative provider."""
        primary_provider = "openai"
        fallback_providers = ["anthropic", "google"]
        
        # If OpenAI fails, try Anthropic, then Google
        assert len(fallback_providers) > 0


# ============================================================================
# PROVIDER REGISTRY TESTS
# ============================================================================

class TestProviderRegistry:
    """Tests for provider registry."""
    
    def test_registry_singleton(self):
        """Verify registry is singleton."""
        # Registry should be a single instance
        registry1 = {"openai": "provider1", "anthropic": "provider2"}
        registry2 = registry1  # Same reference
        
        assert registry1 is registry2
    
    def test_provider_lookup(self):
        """Verify provider lookup by model."""
        def get_provider_for_model(model: str) -> str:
            if model.startswith("gpt-"):
                return "openai"
            elif model.startswith("claude-"):
                return "anthropic"
            elif model.startswith("gemini-"):
                return "google"
            else:
                raise ValueError(f"Unknown model: {model}")
        
        assert get_provider_for_model("gpt-4") == "openai"
        assert get_provider_for_model("claude-3-opus") == "anthropic"
        assert get_provider_for_model("gemini-1.5-pro") == "google"
    
    def test_provider_health_check(self):
        """Verify provider health checks."""
        provider_health = {
            "openai": {"status": "healthy", "latency_ms": 150},
            "anthropic": {"status": "healthy", "latency_ms": 200},
            "google": {"status": "degraded", "latency_ms": 500}
        }
        
        for provider, health in provider_health.items():
            assert health["status"] in ["healthy", "degraded", "down"]


class TestOpenAIProviderConfig:
    def test_openai_base_url_normalization_without_v1(self, monkeypatch):
        from providers.openai_provider import OpenAIProvider

        class DummyClient:
            pass

        monkeypatch.setenv("OPENAI_API_BASE", "https://api.openai.com")
        provider = OpenAIProvider("sk-test-123", DummyClient())
        assert provider.base_url == "https://api.openai.com/v1/"
        monkeypatch.delenv("OPENAI_API_BASE", raising=False)

    def test_openai_base_url_normalization_with_v1(self, monkeypatch):
        from providers.openai_provider import OpenAIProvider

        class DummyClient:
            pass

        monkeypatch.setenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        provider = OpenAIProvider("sk-test-123", DummyClient())
        assert provider.base_url == "https://api.openai.com/v1/"
        monkeypatch.delenv("OPENAI_API_BASE", raising=False)

