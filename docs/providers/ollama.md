# Ollama (Local)

Use Ollama as a local provider via Oxy.

- Endpoint: default `http://localhost:11434` (override with `OLLAMA_BASE_URL`).
- API: OpenAI-compatible `/v1/chat/completions`; Oxy sends OpenAI-format requests.
- Models: use `model="ollama/<name>"` or plain `model="<name>"` (e.g., `llama3`).
- Features: supports streaming and tools if the model/runtime supports them.
- Guardrails: DLP/privacy/budget checks run in the same path as cloud providers.
- Limitations: performance/latency depend on your hardware; Oxy does not manage models/GPUs; ensure the model is pulled (`ollama pull <name>`).
