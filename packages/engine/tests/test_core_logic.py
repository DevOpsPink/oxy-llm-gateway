"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🔬 CORE LOGIC UNIT TESTS                                                    ║
║   Pricing, secrets, response cache, Redis failover                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

Tests every atom of core logic:
- PricingEngine (pricing.py)
- SecretString & CacheEncryption (security_utils.py)
- ResponseCache (response_cache.py)
- RedisFailoverManager (redis_failover.py)

Test Strategy:
- Happy Path: Ideal conditions
- Edge Cases: Zeros, negatives, empty strings, extremes
- Chaos: What if None? What if wrong types?

Run:
    pytest packages/engine/tests/test_core_logic.py -v --tb=short

Coverage:
    pytest tests/test_core_logic.py --cov=core --cov=providers --cov-report=html
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import os
import sys
import json
import hashlib
import time

# Add engine path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================================
# PRICING ENGINE TESTS
# ============================================================================

class TestPricingEngine:
    """Tests for PricingEngine - calculating AI API costs."""
    
    # -------------------------------------------------------------------------
    # HAPPY PATH: Get Pricing
    # -------------------------------------------------------------------------
    
    def test_get_pricing_known_model(self):
        """Known model returns correct pricing."""
        from providers.pricing import PricingEngine
        
        pricing = PricingEngine.get_pricing("gpt-4")
        
        assert pricing["prompt_tokens_per_million"] == Decimal("30.00")
        assert pricing["completion_tokens_per_million"] == Decimal("60.00")
    
    def test_get_pricing_gpt35(self):
        """GPT-3.5 is much cheaper."""
        from providers.pricing import PricingEngine
        
        pricing = PricingEngine.get_pricing("gpt-3.5-turbo")
        
        assert pricing["prompt_tokens_per_million"] == Decimal("0.50")
        assert pricing["completion_tokens_per_million"] == Decimal("1.50")
    
    def test_get_pricing_claude(self):
        """Claude pricing."""
        from providers.pricing import PricingEngine
        
        pricing = PricingEngine.get_pricing("claude-3-5-sonnet-20241022")
        
        assert pricing["prompt_tokens_per_million"] == Decimal("3.00")
        assert pricing["completion_tokens_per_million"] == Decimal("15.00")
    
    def test_get_pricing_gemini(self):
        """Gemini pricing."""
        from providers.pricing import PricingEngine
        
        pricing = PricingEngine.get_pricing("gemini-1.5-pro")
        
        assert pricing["prompt_tokens_per_million"] == Decimal("3.50")
        assert pricing["completion_tokens_per_million"] == Decimal("10.50")
    
    # EDGE CASES
    
    def test_get_pricing_unknown_model(self):
        """Unknown model returns default pricing."""
        from providers.pricing import PricingEngine
        
        pricing = PricingEngine.get_pricing("totally-unknown-model-xyz")
        
        # Should return conservative defaults
        assert pricing["prompt_tokens_per_million"] == Decimal("10.00")
        assert pricing["completion_tokens_per_million"] == Decimal("30.00")
    
    # -------------------------------------------------------------------------
    # HAPPY PATH: Calculate Cost
    # -------------------------------------------------------------------------
    
    def test_calculate_cost_gpt4_basic(self):
        """GPT-4: 1000 prompt + 500 completion tokens."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-4",
            prompt_tokens=1000,
            completion_tokens=500
        )
        
        # 1000/1M * $30 + 500/1M * $60 = $0.03 + $0.03 = $0.06
        assert cost == Decimal("0.060000")
    
    def test_calculate_cost_gpt35_basic(self):
        """GPT-3.5: Much cheaper."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-3.5-turbo",
            prompt_tokens=10000,
            completion_tokens=5000
        )
        
        # 10000/1M * $0.50 + 5000/1M * $1.50 = $0.005 + $0.0075 = $0.0125
        assert cost == Decimal("0.012500")
    
    def test_calculate_cost_million_tokens(self):
        """1 million tokens = full pricing."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-4-turbo",
            prompt_tokens=1_000_000,
            completion_tokens=1_000_000
        )
        
        # 1M * $10/1M + 1M * $30/1M = $10 + $30 = $40
        assert cost == Decimal("40.000000")
    
    # EDGE CASES
    
    def test_calculate_cost_zero_tokens(self):
        """Zero tokens = zero cost."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-4",
            prompt_tokens=0,
            completion_tokens=0
        )
        
        assert cost == Decimal("0.000000")
    
    def test_calculate_cost_only_prompt(self):
        """Only prompt tokens."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-4",
            prompt_tokens=1000,
            completion_tokens=0
        )
        
        # 1000/1M * $30 = $0.03
        assert cost == Decimal("0.030000")
    
    def test_calculate_cost_precision(self):
        """Verify sub-cent precision."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-3.5-turbo",
            prompt_tokens=1,
            completion_tokens=1
        )
        
        # 1/1M * $0.50 + 1/1M * $1.50 = $0.0000005 + $0.0000015 = $0.000002
        assert cost == Decimal("0.000002")
    
    # CHAOS
    
    def test_calculate_cost_very_large_tokens(self):
        """100 million tokens should not overflow."""
        from providers.pricing import PricingEngine
        
        cost = PricingEngine.calculate_cost(
            model="gpt-3.5-turbo",
            prompt_tokens=100_000_000,
            completion_tokens=100_000_000
        )
        
        # 100M/1M * $0.50 + 100M/1M * $1.50 = $50 + $150 = $200
        assert cost == Decimal("200.000000")
    
    # -------------------------------------------------------------------------
    # GOOGLE TIERED PRICING
    # -------------------------------------------------------------------------
    
    def test_google_tiered_pricing_under_threshold(self):
        """Under 128k tokens uses base rate."""
        from providers.pricing import calculate_google_cost
        
        cost = calculate_google_cost(
            model="gemini-1.5-pro",
            input_tokens=100_000,
            output_tokens=50_000
        )
        
        # Input: 100k/1M * $3.50 = $0.35
        # Output: 50k/1M * $10.50 = $0.525
        # Total: $0.875
        assert cost == Decimal("0.875000")
    
    def test_google_tiered_pricing_over_threshold(self):
        """Over 128k tokens uses extended rate for excess."""
        from providers.pricing import calculate_google_cost
        
        cost = calculate_google_cost(
            model="gemini-1.5-pro",
            input_tokens=200_000,  # 128k base + 72k extended
            output_tokens=50_000
        )
        
        # Input: 128k/1M * $3.50 + 72k/1M * $7.00 = $0.448 + $0.504 = $0.952
        # Output: 50k/1M * $10.50 = $0.525
        # Total: $1.477
        assert cost == Decimal("1.477000")
    
    def test_google_tiered_pricing_flash_model(self):
        """Flash model uses cheaper rates."""
        from providers.pricing import calculate_google_cost
        
        cost = calculate_google_cost(
            model="gemini-1.5-flash",
            input_tokens=100_000,
            output_tokens=50_000
        )
        
        # Input: 100k/1M * $0.075 = $0.0075
        # Output: 50k/1M * $0.30 = $0.015
        # Total: $0.0225
        assert cost == Decimal("0.022500")
    
    def test_google_pricing_unknown_model_fallback(self):
        """Unknown Gemini model falls back to standard pricing."""
        from providers.pricing import calculate_google_cost
        
        cost = calculate_google_cost(
            model="gemini-1.0-pro",  # Not in tiered table
            input_tokens=100_000,
            output_tokens=50_000
        )
        
        # Should use PricingEngine.calculate_cost fallback
        assert cost > Decimal("0")
    
    # -------------------------------------------------------------------------
    # HELPER METHODS
    # -------------------------------------------------------------------------
    
    def test_get_supported_models(self):
        """Should return list of all models."""
        from providers.pricing import PricingEngine
        
        models = PricingEngine.get_supported_models()
        
        assert "gpt-4" in models
        assert "claude-3-5-sonnet-20241022" in models
        assert "gemini-1.5-pro" in models
        assert len(models) > 20  # We have many models
    
    def test_get_models_by_provider_openai(self):
        """Filter models by provider."""
        from providers.pricing import PricingEngine
        
        openai_models = PricingEngine.get_models_by_provider("openai")
        
        assert all(m.startswith("gpt-") or m.startswith("o1-") for m in openai_models)
        assert "claude-3-opus-20240229" not in openai_models
    
    def test_get_models_by_provider_anthropic(self):
        """Anthropic models."""
        from providers.pricing import PricingEngine
        
        anthropic_models = PricingEngine.get_models_by_provider("anthropic")
        
        assert all(m.startswith("claude-") for m in anthropic_models)
    
    def test_estimate_max_cost(self):
        """Estimate max cost for budget reservation."""
        from providers.pricing import PricingEngine
        
        max_cost = PricingEngine.estimate_max_cost_for_model("gpt-4", max_tokens=4000)
        
        # 2k prompt + 2k completion for gpt-4
        # 2000/1M * $30 + 2000/1M * $60 = $0.06 + $0.12 = $0.18
        assert max_cost == Decimal("0.180000")


# ============================================================================
# SECURITY UTILS TESTS
# ============================================================================

class TestSecretString:
    """Tests for SecretString - protected string wrapper."""
    
    def test_str_returns_redacted(self):
        """str() should not reveal secret."""
        from security_utils import SecretString
        
        secret = SecretString("super-secret-api-key")
        
        assert str(secret) == "[REDACTED]"
    
    def test_repr_returns_redacted(self):
        """repr() should not reveal secret."""
        from security_utils import SecretString
        
        secret = SecretString("my-password")
        
        assert repr(secret) == "SecretString([REDACTED])"
    
    def test_get_returns_plaintext(self):
        """get() should return actual value."""
        from security_utils import SecretString
        
        value = "sk-proj-abc123"
        secret = SecretString(value)
        
        assert secret.get() == value
    
    def test_bool_truthy(self):
        """Non-empty secret is truthy."""
        from security_utils import SecretString
        
        secret = SecretString("value")
        assert bool(secret) is True
    
    def test_bool_falsy(self):
        """Empty secret is falsy."""
        from security_utils import SecretString
        
        secret = SecretString("")
        assert bool(secret) is False
    
    def test_len(self):
        """Length returns actual length."""
        from security_utils import SecretString
        
        secret = SecretString("12345")
        assert len(secret) == 5
    
    def test_equality(self):
        """Two SecretStrings with same value are equal."""
        from security_utils import SecretString
        
        s1 = SecretString("same")
        s2 = SecretString("same")
        s3 = SecretString("different")
        
        assert s1 == s2
        assert s1 != s3
    
    def test_equality_with_non_secret(self):
        """SecretString != regular string."""
        from security_utils import SecretString
        
        secret = SecretString("value")
        
        assert (secret == "value") is False
    
    def test_hash(self):
        """Can be used as dict key."""
        from security_utils import SecretString
        
        secret = SecretString("key")
        d = {secret: "value"}
        
        assert d[secret] == "value"
    
    def test_immutable_setattr(self):
        """Cannot modify after creation."""
        from security_utils import SecretString
        
        secret = SecretString("original")
        
        with pytest.raises(AttributeError):
            secret._value = "hacked"
    
    def test_immutable_delattr(self):
        """Cannot delete attributes."""
        from security_utils import SecretString
        
        secret = SecretString("value")
        
        with pytest.raises(AttributeError):
            del secret._value
    
    def test_getstate_redacts(self):
        """Pickle serialization redacts value."""
        from security_utils import SecretString
        
        secret = SecretString("sensitive")
        state = secret.__getstate__()
        
        assert state["_value"] == "[REDACTED]"
    
    def test_setstate_raises(self):
        """Cannot unpickle."""
        from security_utils import SecretString
        
        secret = SecretString("value")
        
        with pytest.raises(RuntimeError, match="Cannot unpickle"):
            secret.__setstate__({"_value": "hacked"})
    
    # CHAOS
    
    def test_non_string_raises(self):
        """Must be initialized with string."""
        from security_utils import SecretString
        
        with pytest.raises(TypeError):
            SecretString(12345)
    
    def test_none_raises(self):
        """None should raise TypeError."""
        from security_utils import SecretString
        
        with pytest.raises(TypeError):
            SecretString(None)


class TestLogErrorSafe:
    """Tests for log_error_safe - safe error logging."""
    
    def test_truncates_long_messages(self):
        """Messages > 200 chars should be truncated."""
        from security_utils import log_error_safe
        
        mock_logger = MagicMock()
        long_message = "x" * 500
        error = Exception(long_message)
        
        log_error_safe(mock_logger, "test_event", error)
        
        # Verify logger was called
        mock_logger.error.assert_called_once()
        call_kwargs = mock_logger.error.call_args[1]
        
        # Message should be truncated
        assert len(call_kwargs["error_message"]) <= 215  # 200 + "... (truncated)"
    
    def test_redacts_api_keys(self):
        """Messages containing secrets should be redacted."""
        from security_utils import log_error_safe
        
        mock_logger = MagicMock()
        error = Exception("Failed with sk-proj-abc123secret")
        
        log_error_safe(mock_logger, "test_event", error)
        
        call_kwargs = mock_logger.error.call_args[1]
        assert call_kwargs["error_message"] == "[REDACTED ERROR MESSAGE - CONTAINS SECRETS]"
    
    def test_redacts_bearer_token(self):
        """Bearer tokens should be redacted."""
        from security_utils import log_error_safe
        
        mock_logger = MagicMock()
        error = Exception("Auth failed: Bearer eyJtoken...")
        
        log_error_safe(mock_logger, "test_event", error)
        
        call_kwargs = mock_logger.error.call_args[1]
        assert call_kwargs["error_message"] == "[REDACTED ERROR MESSAGE - CONTAINS SECRETS]"
    
    def test_includes_error_type(self):
        """Error type should be logged."""
        from security_utils import log_error_safe
        
        mock_logger = MagicMock()
        error = ValueError("Invalid input")
        
        log_error_safe(mock_logger, "test_event", error)
        
        call_kwargs = mock_logger.error.call_args[1]
        assert call_kwargs["error_type"] == "ValueError"
    
    def test_no_exc_info(self):
        """Should not log stack trace."""
        from security_utils import log_error_safe
        
        mock_logger = MagicMock()
        error = Exception("test")
        
        log_error_safe(mock_logger, "test_event", error)
        
        call_kwargs = mock_logger.error.call_args[1]
        assert call_kwargs["exc_info"] is False


class TestCacheEncryption:
    """Tests for CacheEncryption - Redis data encryption."""
    
    @pytest.fixture
    def encryptor(self):
        from security_utils import CacheEncryption
        return CacheEncryption("test-master-key-12345")
    
    def test_encrypt_decrypt_roundtrip(self, encryptor):
        """Encrypt then decrypt returns original."""
        original = "sensitive-api-key-data"
        
        encrypted = encryptor.encrypt(original)
        decrypted = encryptor.decrypt(encrypted)
        
        assert decrypted == original
    
    def test_encrypted_differs_from_plaintext(self, encryptor):
        """Encrypted data should not match plaintext."""
        plaintext = "my-secret"
        
        encrypted = encryptor.encrypt(plaintext)
        
        assert encrypted != plaintext
        assert "my-secret" not in encrypted
    
    def test_consistent_encryption_key(self):
        """Same master key = same encryption results."""
        from security_utils import CacheEncryption
        
        enc1 = CacheEncryption("same-key")
        enc2 = CacheEncryption("same-key")
        
        # Encrypt with first
        plaintext = "test-data"
        encrypted = enc1.encrypt(plaintext)
        
        # Note: Fernet uses random IV, so encrypted output differs
        # But both should decrypt correctly
        decrypted = enc2.decrypt(encrypted)
        assert decrypted == plaintext
    
    def test_different_keys_fail(self):
        """Different master key fails decryption."""
        from security_utils import CacheEncryption
        from cryptography.fernet import InvalidToken
        
        enc1 = CacheEncryption("key-one")
        enc2 = CacheEncryption("key-two")
        
        encrypted = enc1.encrypt("secret")
        
        with pytest.raises(InvalidToken):
            enc2.decrypt(encrypted)
    
    def test_encrypt_empty_string(self, encryptor):
        """Empty string can be encrypted."""
        encrypted = encryptor.encrypt("")
        decrypted = encryptor.decrypt(encrypted)
        
        assert decrypted == ""
    
    def test_encrypt_unicode(self, encryptor):
        """Unicode characters work correctly."""
        original = "API密钥🔑émoji"
        
        encrypted = encryptor.encrypt(original)
        decrypted = encryptor.decrypt(encrypted)
        
        assert decrypted == original


class TestSanitizeErrorForClient:
    """Tests for sanitize_error_for_client."""
    
    def test_basic_sanitization(self):
        """Error details should be hidden."""
        from security_utils import sanitize_error_for_client
        
        error = ValueError("Sensitive database error: user_id=123")
        
        result = sanitize_error_for_client(error)
        
        assert result["error"] == "Internal server error"
        assert result["type"] == "internal_error"
        assert "database" not in str(result)
        assert "user_id" not in str(result)
    
    def test_with_details_flag(self):
        """include_details adds debug_type."""
        from security_utils import sanitize_error_for_client
        
        error = KeyError("missing_key")
        
        result = sanitize_error_for_client(error, include_details=True)
        
        assert result["debug_type"] == "KeyError"
        assert "missing_key" not in str(result)


# ============================================================================
# RESPONSE CACHE TESTS
# ============================================================================

class TestResponseCache:
    """Tests for ResponseCache - AI response caching logic."""
    
    @pytest.fixture
    def mock_redis(self):
        return AsyncMock()
    
    @pytest.fixture
    def cache(self, mock_redis):
        from core.response_cache import ResponseCache
        return ResponseCache(mock_redis)
    
    # -------------------------------------------------------------------------
    # SHOULD CACHE LOGIC
    # -------------------------------------------------------------------------
    
    def test_should_cache_deterministic(self, cache):
        """temperature=0 should be cached."""
        params = {"temperature": 0, "stream": False, "model": "gpt-4"}
        assert cache._should_cache(params) is True
    
    def test_should_not_cache_creative(self, cache):
        """temperature>0 should not be cached."""
        params = {"temperature": 0.7, "stream": False, "model": "gpt-4"}
        assert cache._should_cache(params) is False
    
    def test_should_not_cache_streaming(self, cache):
        """stream=True should not be cached."""
        params = {"temperature": 0, "stream": True, "model": "gpt-4"}
        assert cache._should_cache(params) is False
    
    def test_should_not_cache_image_models(self, cache):
        """Image models should not be cached."""
        params = {"temperature": 0, "stream": False, "model": "dall-e-3"}
        assert cache._should_cache(params) is False
    
    def test_should_not_cache_vision(self, cache):
        """Vision models should not be cached."""
        params = {"temperature": 0, "stream": False, "model": "gpt-4-vision-preview"}
        assert cache._should_cache(params) is False
    
    def test_should_cache_default_temperature(self, cache):
        """Missing temperature defaults to 1.0 (not cached)."""
        params = {"stream": False, "model": "gpt-4"}
        assert cache._should_cache(params) is False
    
    # -------------------------------------------------------------------------
    # CACHE KEY GENERATION
    # -------------------------------------------------------------------------
    
    def test_generate_cache_key_deterministic(self, cache):
        """Same input = same key."""
        messages = [{"role": "user", "content": "Hello"}]
        params = {"temperature": 0, "max_tokens": 100}
        
        key1 = cache._generate_cache_key("openai", "gpt-4", messages, params)
        key2 = cache._generate_cache_key("openai", "gpt-4", messages, params)
        
        assert key1 == key2
    
    def test_generate_cache_key_different_provider(self, cache):
        """Different provider = different key."""
        messages = [{"role": "user", "content": "Hello"}]
        params = {"temperature": 0}
        
        key1 = cache._generate_cache_key("openai", "gpt-4", messages, params)
        key2 = cache._generate_cache_key("anthropic", "gpt-4", messages, params)
        
        assert key1 != key2
    
    def test_generate_cache_key_different_model(self, cache):
        """Different model = different key."""
        messages = [{"role": "user", "content": "Hello"}]
        params = {"temperature": 0}
        
        key1 = cache._generate_cache_key("openai", "gpt-4", messages, params)
        key2 = cache._generate_cache_key("openai", "gpt-3.5-turbo", messages, params)
        
        assert key1 != key2
    
    def test_generate_cache_key_ignores_metadata(self, cache):
        """User/metadata should not affect key."""
        messages = [{"role": "user", "content": "Hello"}]
        
        key1 = cache._generate_cache_key("openai", "gpt-4", messages, {"temperature": 0})
        key2 = cache._generate_cache_key("openai", "gpt-4", messages, {"temperature": 0, "user": "test123", "metadata": {"x": 1}})
        
        assert key1 == key2
    
    def test_cache_key_is_sha256(self, cache):
        """Key should be SHA-256 hash."""
        from core.response_cache import RESPONSE_CACHE_PREFIX
        
        key = cache._generate_cache_key("openai", "gpt-4", [], {})
        
        assert key.startswith(RESPONSE_CACHE_PREFIX)
        # SHA-256 is 64 hex chars
        hash_part = key.replace(RESPONSE_CACHE_PREFIX, "")
        assert len(hash_part) == 64
    
    # -------------------------------------------------------------------------
    # COMPRESSION
    # -------------------------------------------------------------------------
    
    def test_compression_roundtrip(self, cache):
        """Compress then decompress returns original."""
        original = {"response": "test", "data": [1, 2, 3]}
        
        compressed = cache._compress_response(original)
        decompressed = cache._decompress_response(compressed)
        
        assert decompressed == original
    
    def test_compression_reduces_size(self, cache):
        """Compressed data should be smaller for large responses."""
        large_response = {"text": "Lorem ipsum " * 1000}
        
        json_size = len(json.dumps(large_response).encode())
        compressed = cache._compress_response(large_response)
        
        assert len(compressed) < json_size


# ============================================================================
# REDIS FAILOVER TESTS
# ============================================================================

class TestRedisFailoverManager:
    """Tests for RedisFailoverManager - circuit breaker logic."""
    
    @pytest.fixture
    def manager(self):
        from core.redis_failover import RedisFailoverManager
        return RedisFailoverManager()
    
    def test_initial_state_uses_redis(self, manager):
        """Fresh manager should use Redis."""
        assert manager.should_use_redis() is True
    
    def test_success_keeps_circuit_closed(self, manager):
        """Successful operations don't open circuit."""
        manager.record_success()
        
        assert manager.circuit_open is False
        assert manager.failure_count == 0
    
    def test_single_failure_doesnt_open(self, manager):
        """One failure doesn't open circuit."""
        manager.record_failure()
        
        assert manager.circuit_open is False
        assert manager.failure_count == 1
    
    def test_threshold_failures_opens_circuit(self, manager):
        """5 failures in window opens circuit."""
        for _ in range(5):
            manager.record_failure()
        
        assert manager.circuit_open is True
        assert manager.should_use_redis() is False
    
    def test_open_circuit_skips_redis(self, manager):
        """Open circuit returns False for should_use_redis."""
        # Force open
        for _ in range(5):
            manager.record_failure()
        
        assert manager.should_use_redis() is False
    
    def test_circuit_recovers_after_timeout(self, manager):
        """Circuit becomes half-open after timeout."""
        import time
        
        # Open circuit
        for _ in range(5):
            manager.record_failure()
        
        # Simulate time passing (hack for testing)
        manager.circuit_open_at = time.time() - 60  # 60 seconds ago
        
        # Now should try Redis again
        assert manager.should_use_redis() is True
        assert manager.circuit_open is False  # Half-open becomes closed on check
    
    def test_success_after_half_open_closes(self, manager):
        """Success after half-open state closes circuit."""
        # Open then simulate recovery
        for _ in range(5):
            manager.record_failure()
        
        manager.circuit_open = False  # Simulate half-open check
        manager.record_success()
        
        assert manager.circuit_open is False
        assert manager.failure_count == 0
    
    def test_failure_outside_window_resets(self, manager):
        """Failures outside 60s window are reset."""
        import time
        
        manager.record_failure()
        manager.record_failure()
        
        # Simulate time passing
        manager.last_failure_time = time.time() - 120  # 2 minutes ago
        
        manager.record_failure()  # Should reset counter
        
        assert manager.failure_count == 1  # Reset to 1


# ============================================================================
# INTEGRATION: REDIS WITH FALLBACK
# ============================================================================

class TestRedisWithFallback:
    """Tests for redis_with_fallback helper function."""
    
    @pytest.mark.asyncio
    async def test_success_uses_redis(self):
        """Successful Redis call doesn't use fallback."""
        from core.redis_failover import redis_with_fallback, RedisOperation
        
        redis_func = AsyncMock(return_value="redis_result")
        fallback_func = AsyncMock(return_value="fallback_result")
        
        result = await redis_with_fallback(
            operation=RedisOperation.GET_API_KEY,
            redis_func=redis_func,
            fallback_func=fallback_func
        )
        
        assert result == "redis_result"
        redis_func.assert_called_once()
        fallback_func.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_redis_failure_uses_fallback(self):
        """Redis failure triggers fallback."""
        from core.redis_failover import redis_with_fallback, RedisOperation, failover_manager
        from redis.exceptions import ConnectionError as RedisConnectionError
        
        # Reset state
        failover_manager.circuit_open = False
        failover_manager.failure_count = 0
        
        redis_func = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
        fallback_func = AsyncMock(return_value="fallback_result")
        
        result = await redis_with_fallback(
            operation=RedisOperation.GET_API_KEY,
            redis_func=redis_func,
            fallback_func=fallback_func
        )
        
        assert result == "fallback_result"
        fallback_func.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_skip_fallback_raises(self):
        """skip_fallback=True raises exception on Redis failure."""
        from core.redis_failover import redis_with_fallback, RedisOperation, failover_manager
        from redis.exceptions import ConnectionError as RedisConnectionError
        
        # Reset state
        failover_manager.circuit_open = False
        failover_manager.failure_count = 0
        
        redis_func = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
        fallback_func = AsyncMock()
        
        with pytest.raises(RedisConnectionError):
            await redis_with_fallback(
                operation=RedisOperation.CACHE_RESPONSE,
                redis_func=redis_func,
                fallback_func=fallback_func,
                skip_fallback=True
            )
        
        fallback_func.assert_not_called()

