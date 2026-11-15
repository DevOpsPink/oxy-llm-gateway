# Cloud Providers

Oxy proxies to major cloud LLMs using your API keys. Configuration is controlled via environment variables and management endpoints.

## What this covers
- OpenAI, Anthropic, Google (Gemini) as enabled in code.
- Provider selection per request via model name and configured routing.
- Budget checks, optional caching, and logging (metadata by default) applied before forwarding.

## What this does NOT guarantee (best-effort, not an SLA)
- No uptime/latency/SLA guarantees for upstream providers or Oxy; best-effort only.
- No automatic key provisioning; you supply and rotate your own keys.
- No cost cap beyond configured budgets/alerts you set.

## Configuration
- Set provider keys in environment (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`).
- Use management endpoints (`/v1/providers/config`) to enable/disable providers per org/project where applicable.
- Keys are expected in environment/Supabase; they are not stored in UI DB.

## Sending requests
- Data plane: `POST /v1/chat/completions` with `model` mapped to the chosen provider.
- Budget and privacy modes apply before the request is sent.

## Limitations / known gaps
- Routing is static to the model/provider specified; no automatic price/perf optimization unless configured separately.
- Provider-specific features (vision, tools, etc.) depend on upstream support and your plan.***
