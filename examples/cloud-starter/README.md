# Cloud Starter (OpenAI/Anthropic via Oxy)

Minimal Python client calling Oxy as a proxy to a cloud LLM. Demonstrates kill switch headers and budgets on the gateway path.

## Prerequisites
- Python 3.10+
- `requests` installed (`python -m pip install requests`)
- Oxy gateway running and accessible (with a valid API key and agent/session IDs if you use agent tracking)

## How to run
```bash
export OXY_API_KEY="oxy_live_xxx"
export OXY_BASE_URL="http://localhost:8000"  # replace with your gateway URL
python client.py
```

## What this shows
- Sends `/v1/chat/completions` through Oxy.
- Passes optional `X-Oxy-Agent-Id` and `X-Oxy-Session-Id` headers so kill switch/session termination can block the stream.
- Budgets and free-tier limits are enforced in the proxy path if configured (see FEATURE_MATRIX entry `budgets`).

## Mapping to FEATURE_MATRIX
- `kill-switch`: stop a session by calling `DELETE /v1/agents/{agent_id}/sessions/{session_id}`; this client will be blocked mid-stream.
- `budgets`: free/budget limits enforced in proxy.
- `privacy-modes`: logging is controlled server-side (defaults to metadata_only).
```
