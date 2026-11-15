"""
Minimal DLP v0.1 tests (secrets-focused, no PII expansion).
"""

import pytest
from fastapi import HTTPException

from routes.proxy import ai_error, scan_for_secrets, scan_tool_call_for_secrets, redact_secrets


class TestDLP:
    def test_incoming_secret_triggers_block(self):
        """Messages containing secrets should trigger DLP block (451 DLP_BLOCKED)."""
        # Use a credit-card test number that matches DLP_PATTERNS
        messages = [
            {"role": "user", "content": "Here is my card: 4111111111111111"}
        ]

        dlp_result = scan_for_secrets(messages)
        assert dlp_result["threat_detected"] is True
        assert dlp_result["threat_type"] != "none"

        if dlp_result["threat_detected"]:
            with pytest.raises(HTTPException) as exc:
                raise ai_error(
                    status_code=451,
                    code="DLP_BLOCKED",
                    message=f"Request blocked: Sensitive data detected ({dlp_result['threat_type']}).",
                    hint="Remove sensitive data from your prompt."
                )
            assert exc.value.status_code == 451
            # ai_error wraps detail under ["error"]["code"]
            assert exc.value.detail["error"]["code"] == "DLP_BLOCKED"

    def test_detects_email_and_api_key(self):
        messages = [
            {"role": "user", "content": "email me at test@example.com"},
            {"role": "user", "content": "api_key=sk-test-123456"},
        ]
        dlp_result = scan_for_secrets(messages)
        assert dlp_result["threat_detected"] is True
        assert dlp_result["threat_type"] != "none"
        assert dlp_result["threat_count"] >= 2

    def test_tool_call_arguments_are_redacted(self):
        """Tool call arguments with secrets are detected and redacted (log + redact path)."""
        tool_call = {
            "function": {
                "name": "process_payment",
                "arguments": "number=4111111111111111&cvv=123"
            }
        }

        tc_dlp = scan_tool_call_for_secrets(tool_call)
        assert tc_dlp["threat_detected"] is True
        assert tc_dlp["threat_type"] != "none"

        redacted_args = redact_secrets(tool_call["function"]["arguments"])
        # Current redaction tags the pattern type, e.g., [REDACTED_CREDIT_CARD]
        assert "[REDACTED" in redacted_args
        # Original secret should no longer appear
        assert "4111111111111111" not in redacted_args


# Token shapes are generated at run time: no token-shaped literal lives in the repository.
import random as _random
import string as _string


def _rand(n, alphabet=_string.ascii_letters + _string.digits):
    return "".join(_random.choice(alphabet) for _ in range(n))


@pytest.mark.parametrize("kind,value", [
    ("github_token", lambda: "ghp_" + _rand(36)),
    ("github_token", lambda: "github_pat_" + _rand(40, _string.ascii_letters + _string.digits + "_")),
    ("slack_token", lambda: "xoxb-" + _rand(12, _string.digits) + "-" + _rand(24)),
    ("google_api_key", lambda: "AIza" + _rand(35, _string.ascii_letters + _string.digits + "_-")),
])
def test_dlp_detects_more_token_types(kind, value):
    result = scan_for_secrets([{"role": "user", "content": "token: " + value()}])
    assert result["threat_detected"] is True
    assert kind in result["details"]

