import json

from routes.proxy import maybe_handle_gateway_healthcheck


def test_healthcheck_fast_path_returns_pong():
    model = "gpt-4.1-mini"
    messages = [
        {
            "role": "system",
            "content": "You are a healthcheck bot for the Oxy Gateway. Always respond with exactly: pong from Oxy Gateway."
        },
        {"role": "user", "content": "ping"},
    ]
    provider_kwargs = {}

    resp = maybe_handle_gateway_healthcheck(model, messages, provider_kwargs)
    assert resp is not None
    data = json.loads(resp.body)
    assert data["choices"][0]["message"]["content"] == "pong from Oxy Gateway"
    assert data["choices"][0]["message"]["role"] == "assistant"

