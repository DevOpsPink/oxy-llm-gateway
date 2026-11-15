# Local Ollama Agent (Zero Prompt Logging)

Runs Oxy with a local Ollama model and privacy set to `zero_prompt_logging`.

## Prerequisites
- Docker + Docker Compose
- Oxy environment variables configured (Supabase/Redis URLs). This compose uses Redis; Supabase URL is a placeholder—point to your instance.

## Run
```bash
cd examples/local-ollama-agent
docker-compose up -d
# optionally pull a small model
docker-compose exec ollama ollama pull llama3
```

## Configure privacy and agent
- Set org privacy mode to zero_prompt_logging: `POST /v1/privacy { "privacy_mode": "zero_prompt_logging" }`.
- Create an agent that uses a local provider (configured in `packages/engine/providers/local_provider.py`).
- Call `/v1/chat/completions` with `model` mapped to your local model (e.g., `llama3`).

## Mapping to FEATURE_MATRIX
- `privacy-modes`: org privacy set to zero_prompt_logging.
- `kill-switch`: terminate sessions via `/v1/agents/{agent_id}/sessions/{session_id}`.
- `budgets`: enforced per agent/org if configured (same proxy path).
- `providers/local`: demonstrate local-only inference (no cloud calls).
