# Hybrid Stack (Local vLLM + Cloud)

Runs Oxy with a local vLLM endpoint plus cloud providers; route requests to local or cloud models.

## Prerequisites
- Docker + Docker Compose
- Provider keys for cloud models set in Oxy environment.

## Run
```bash
cd examples/hybrid-stack
docker-compose up -d
```

Local vLLM is exposed on `http://localhost:8001`. Configure a model name via `VLLM_MODEL` or adjust the compose file.

## Routing
- For local: use the model name served by vLLM (e.g., `llama-3-8b-local`) in `/v1/chat/completions`.
- For cloud: use standard model IDs (e.g., `gpt-4o`, `claude-3-5-sonnet`).
- You can add simple routing in your client (e.g., based on cost/latency) or in a lightweight middleware.

## Mapping to FEATURE_MATRIX
- `providers/cloud` and local provider: demonstrates hybrid routing.
- `privacy-modes`: logging defaults apply; set per org/agent.
- `kill-switch` and `budgets`: still enforced in the proxy path for both local and cloud routes.
