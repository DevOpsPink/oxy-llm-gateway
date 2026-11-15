"""
OXY ENGINE - SECURITY UTILITIES
================================
Critical security utilities for protecting sensitive data.

Features:
- SecretString: Protected string wrapper that prevents accidental logging
- log_error_safe: Safe error logging without secret leakage
- Encryption utilities for Redis cache

Author: Oxy contributors
"""

import hashlib
import base64
import structlog
from typing import Any
from cryptography.fernet import Fernet

log = structlog.get_logger()


class SecretString:
    """
    Protected string wrapper that prevents accidental logging of secrets.
    
    CRITICAL: Use this for ALL sensitive data (API keys, tokens, passwords).
    
    Features:
    - __str__ and __repr__ return "[REDACTED]"
    - Sentry/logging frameworks cannot capture the actual value
    - Must explicitly call .get() to access plaintext
    
    Example:
        api_key = SecretString("sk-proj-abc123...")
        print(api_key)  # Output: [REDACTED]
        headers = {"Authorization": f"Bearer {api_key.get()}"}  # Explicit access
    """
    
    __slots__ = ('_value',)
    
    def __init__(self, value: str):
        if not isinstance(value, str):
            raise TypeError(f"SecretString requires str, got {type(value)}")
        object.__setattr__(self, '_value', value)
    
    def get(self) -> str:
        """
        Get plaintext value.
        
        SECURITY: Only call this when you need to use the actual secret.
        Never pass the result to logging or serialization functions.
        """
        return object.__getattribute__(self, '_value')
    
    def __str__(self) -> str:
        return "[REDACTED]"
    
    def __repr__(self) -> str:
        return "SecretString([REDACTED])"
    
    def __eq__(self, other: Any) -> bool:
        if isinstance(other, SecretString):
            return self.get() == other.get()
        return False
    
    def __hash__(self) -> int:
        return hash(self.get())
    
    def __bool__(self) -> bool:
        return bool(self.get())
    
    def __len__(self) -> int:
        return len(self.get())
    
    def __setattr__(self, name: str, value: Any) -> None:
        raise AttributeError("SecretString is immutable")
    
    def __delattr__(self, name: str) -> None:
        raise AttributeError("SecretString is immutable")
    
    def __getstate__(self):
        """Prevent pickling with actual value."""
        return {"_value": "[REDACTED]"}
    
    def __setstate__(self, state):
        """Prevent unpickling."""
        raise RuntimeError("Cannot unpickle SecretString")


def log_error_safe(
    logger: structlog.BoundLogger,
    event: str,
    exc: Exception,
    **context
) -> None:
    """
    Safe error logging without secret leakage.
    
    CRITICAL: Use this instead of log.error(..., exc_info=True) in production.
    
    Features:
    - Does NOT log full stack trace (prevents local variable capture)
    - Logs only exception type and sanitized message
    - Truncates error messages to 200 chars
    - Redacts known secret patterns
    
    Args:
        logger: structlog logger instance
        event: Event name (e.g., "auth_failed")
        exc: Exception instance
        **context: Additional context to log
    
    Example:
        try:
            result = await api_call()
        except Exception as e:
            log_error_safe(log, "api_call_failed", e, user_id=user_id)
            raise HTTPException(...)
    """
    error_type = type(exc).__name__
    error_message = str(exc)
    
    # Redact known secret patterns
    secret_patterns = [
        "sk-proj-", "sk-", "Bearer ", "Authorization:",
        "password=", "token=", "apikey=", "api_key="
    ]
    
    for pattern in secret_patterns:
        if pattern in error_message:
            error_message = "[REDACTED ERROR MESSAGE - CONTAINS SECRETS]"
            break
    
    # Truncate to prevent log flooding
    if len(error_message) > 200:
        error_message = error_message[:200] + "... (truncated)"
    
    logger.error(
        event,
        error_type=error_type,
        error_message=error_message,
        exc_info=False,  # CRITICAL: Do not log stack trace
        **context
    )


class CacheEncryption:
    """
    Encryption utilities for Redis cache.
    
    CRITICAL: Encrypts sensitive data (API keys) before storing in Redis.
    Uses Fernet (symmetric encryption) with key derived from SUPABASE_KEY.
    
    Features:
    - Deterministic key derivation (same key every time)
    - Fast encryption/decryption
    - Protects against Redis compromise
    """
    
    def __init__(self, master_key: str):
        """
        Initialize encryption with master key.
        
        Args:
            master_key: Master key (typically SUPABASE_KEY) for key derivation
        """
        self._cipher = self._create_cipher(master_key)
    
    @staticmethod
    def _create_cipher(master_key: str) -> Fernet:
        """Derive encryption key from master key."""
        key_hash = hashlib.sha256(master_key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key_hash)
        return Fernet(fernet_key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Base64-encoded ciphertext
        """
        try:
            ciphertext_bytes = self._cipher.encrypt(plaintext.encode())
            return ciphertext_bytes.decode()
        except Exception as e:
            log.error("cache_encryption_failed", error_type=type(e).__name__)
            raise
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt ciphertext string.
        
        Args:
            ciphertext: Base64-encoded ciphertext
            
        Returns:
            Plaintext string
        """
        try:
            plaintext_bytes = self._cipher.decrypt(ciphertext.encode())
            return plaintext_bytes.decode()
        except Exception as e:
            log.error("cache_decryption_failed", error_type=type(e).__name__)
            raise


def sanitize_error_for_client(error: Exception, include_details: bool = False) -> dict:
    """
    Sanitize error for client response.
    
    CRITICAL: Never expose internal error details to clients.
    
    Args:
        error: Exception instance
        include_details: If True, include sanitized error type (for development)
        
    Returns:
        dict with "error" and "type" keys
    """
    if include_details:
        error_type = type(error).__name__
        return {
            "error": "Internal server error",
            "type": "internal_error",
            "debug_type": error_type  # Only for development
        }
    
    return {
        "error": "Internal server error",
        "type": "internal_error"
    }

