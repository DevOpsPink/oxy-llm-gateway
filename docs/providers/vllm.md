# vLLM (Local)

Use vLLM as a local provider via its OpenAI-compatible endpoint.

- Endpoint: default `http://localhost:8000` (override with `VLLM_BASE_URL`).
- API: OpenAI-compatible `/v1/chat/completions`; Oxy sends OpenAI-format requests.
- Models: use `model="vllm/<name>"` (e.g., `vllm/mistral-7b`).
- Guardrails: DLP/privacy/budget checks run in the same path as cloud providers.
- Limitations: performance/latency depend on your deployment; ensure the model is served in vLLM.
