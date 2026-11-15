# Recipe: Local Ollama Agent (Zero Prompt Logging)

Run Oxy with a local Ollama model and privacy mode set to zero_prompt_logging.

- Example path: `examples/local-ollama-agent/`
- Prereqs: Docker + Compose; configure Supabase/Redis env for Oxy; pull a small Ollama model.
- Run: `docker-compose up -d` then `docker-compose exec ollama ollama pull llama3`.
- Set org privacy: `POST /v1/privacy { "privacy_mode": "zero_prompt_logging" }`.
- Use local model name in `/v1/chat/completions` to route to Ollama.
- For provider setup details, see `docs/providers/ollama.md` and `docs/providers/local-llm.md`.

Related FEATURE_MATRIX:
- `privacy-modes`, `kill-switch`, `budgets`, local providers.
