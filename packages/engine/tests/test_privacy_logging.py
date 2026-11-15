from core.privacy_logging import sanitize_event_for_logging


def _sample_event():
    return {
        "user_id": "u1",
        "project_id": "p1",
        "organization_id": "o1",
        "model": "gpt-4",
        "provider": "openai",
        "status": "success",
        "threat_detected": False,
        "threat_type": "none",
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "tokens_input": 10,
        "tokens_output": 5,
        "tokens_total": 15,
        "cost_usd": 0.12,
        "subscription_id": "sub",
        "cache_hit": False,
        "cost_tags": {"project_id": "p1"},
        "prompt_text": "USER: secret prompt",
        "response_text": "ASSISTANT: secret response",
    }


def test_zero_prompt_logging_drops_text():
    event = _sample_event()
    payload = sanitize_event_for_logging(privacy_mode="zero_prompt_logging", event=event, debug_full_allowed=True)
    assert payload["privacy_mode"] == "zero_prompt_logging"
    assert payload["prompt_snapshot"] is None
    assert payload["response_snapshot"] is None


def test_metadata_only_drops_text():
    event = _sample_event()
    payload = sanitize_event_for_logging(privacy_mode="metadata_only", event=event, debug_full_allowed=True)
    assert payload["privacy_mode"] == "metadata_only"
    assert payload["prompt_snapshot"] is None
    assert payload["response_snapshot"] is None


def test_debug_full_stores_text_when_allowed():
    event = _sample_event()
    payload = sanitize_event_for_logging(privacy_mode="debug_full", event=event, debug_full_allowed=True)
    assert payload["privacy_mode"] == "debug_full"
    assert payload["prompt_snapshot"] == "USER: secret prompt"
    assert payload["response_snapshot"] == "ASSISTANT: secret response"


def test_debug_full_blocked_when_flag_false():
    event = _sample_event()
    payload = sanitize_event_for_logging(privacy_mode="debug_full", event=event, debug_full_allowed=False)
    assert payload["privacy_mode"] == "debug_full"
    assert payload["prompt_snapshot"] is None
    assert payload["response_snapshot"] is None
    assert "prompt_text" not in payload
    assert "response_text" not in payload
