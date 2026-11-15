# Recipe: Cloud Starter (OpenAI/Anthropic via Oxy)

Run a minimal client through Oxy to a cloud LLM, showing kill switch and budgets.

- Example path: `examples/cloud-starter/`
- Prereqs: Oxy running, API key, Python 3.10+, `requests`.
- Run: `OXY_API_KEY=... OXY_BASE_URL=... python client.py`
- Demonstrates: `/v1/chat/completions`, optional agent/session headers for kill switch, proxy-enforced budgets/free-tier limits.

Related FEATURE_MATRIX:
- `kill-switch`, `budgets`, `privacy-modes`.
