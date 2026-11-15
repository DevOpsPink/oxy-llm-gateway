"""
Minimal smoke test for /v1/chat/completions.

Assumes the backend is running locally on http://localhost:8000 and that
an Oxy API key is available in the environment variable OXY_API_KEY.
"""

import os

import httpx
import pytest


API_URL = os.getenv("OXY_API_URL", "http://localhost:8000")
API_KEY = os.getenv("OXY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


@pytest.mark.smoke
def test_chat_completions_smoke():
    if not API_KEY:
        pytest.skip("Set OXY_API_KEY to run the chat completions smoke test.")
    if not OPENAI_API_KEY:
        pytest.skip("Set OPENAI_API_KEY to run the provider smoke test against OpenAI.")

    payload = {
        "model": "gpt-4.1-mini",
        "messages": [
            {"role": "user", "content": "Hello Oxy Core, respond with a short greeting."}
        ],
        "stream": False,
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(base_url=API_URL, timeout=30.0) as client:
            resp = client.post("/v1/chat/completions", json=payload, headers=headers)
    except httpx.ConnectError:
        pytest.skip("Backend not running at API_URL; skipping smoke test.")

    assert resp.status_code == 200, f"Unexpected status: {resp.status_code}, body: {resp.text}"

    data = resp.json()
    choices = data.get("choices", [])
    assert isinstance(choices, list) and len(choices) > 0, "Response choices array is empty."

