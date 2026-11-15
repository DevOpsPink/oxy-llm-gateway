# Local LLMs (GA)

Oxy can route to local model runtimes such as Ollama, vLLM, or OpenAI-compatible HTTP endpoints, using the same chat completions schema as cloud models.

## What this covers
- Supported local endpoints: Ollama (`OLLAMA_BASE_URL`), vLLM (`VLLM_BASE_URL`), generic OpenAI-compatible HTTP (`LOCAL_HTTP_BASE_URL`), plus `local/` model prefixes routed via provider factory.
- Same OpenAI-style request/response schema; streaming supported where backend supports SSE.
- Gateway controls still apply: guardrails (DLP), privacy modes, budgets, logging/retention, rate limits.

## What this does NOT guarantee (best-effort, not an SLA)
- Oxy does not manage your hardware/resources; performance/latency/quality depend on your deployment (best-effort).
- No SLAs; ensure capacity and isolation for your models.
- Compatibility depends on the backend honoring OpenAI-style APIs; verify in staging.

## Configuration
- Env:
  - `OLLAMA_BASE_URL` (default http://localhost:11434)
  - `VLLM_BASE_URL` (default http://localhost:8000)
  - `LOCAL_HTTP_BASE_URL` (optional OpenAI-compatible endpoint)
  - `LOCAL_MODEL_TIMEOUT` (default 120s)
- Provider config: enable local providers via `/v1/providers/config` and allowed models.
- Ensure network access from Oxy to the local runtime; secure the runtime (auth/WAF/segmentation).

## Sending requests
- `POST /v1/chat/completions` with model naming:
  - `ollama/llama3.2` or `llama3.2` (Ollama)
  - `vllm/mistral-7b` (vLLM OpenAI compat)
  - `local/phi-3` (uses LOCAL_HTTP_BASE_URL if set; otherwise local → Ollama fallback)
- Privacy modes, budgets, DLP, logging, and rate limits apply as with cloud providers.

## Limitations / known gaps
- Feature parity and quality are backend-dependent.
- Tooling/streaming support depends on the local runtime implementation.
- No managed capacity or SLAs; best-effort only.
