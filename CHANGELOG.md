# Changelog

## 1.0.0 — 2026-11-15

Oxy is a self-hosted LLM gateway: a FastAPI engine with an OpenAI-compatible `/v1/chat/completions` endpoint, a Next.js dashboard, and Postgres with PostgREST and GoTrue for data and sign-in. It puts budgets, DLP, a kill switch, audit logs and cost attribution in front of OpenAI, Anthropic, Gemini and local models. It is an Apache 2.0 reference implementation.

### Getting started

- `docker compose up` starts the whole stack from a clean clone with no `.env` file, cloud account or provider key. `packages/engine/.env` and `packages/ui/.env.local` are optional overrides.
- Sign-in works on the local stack: magic-link mail lands in Mailpit at <http://localhost:8025>.
- Stripe is optional. Without `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only the endpoints that call Stripe answer 503; plan limits and usage still come from Postgres.
- Development ports are published on 127.0.0.1 only, and third-party images are pinned by digest.

### Proofs

- The README's main claims are measured end to end against a recording fake provider: budgets are never overspent (also across the budget worker's sync cycles and after Redis loses the spend counter), DLP keeps secrets from reaching the provider, the kill switch stops a running agent, another tenant's agent and session ids are refused, a revoked key stops at once, requests the gateway cannot check without Redis are refused, the browser cannot reach the engine's database functions or an open table policy, no tenant API key is stored in Redis, and every request is audited, refusals included.
- CI runs the proofs, then plants the violation each proof exists to catch and requires that proof to fail.
- A `status` branch (`.github/workflows/status.yml`) records the last 30 days of CI runs on main and the latest proofs, in the same shape as the other fleet repositories.

### Try it

- `.devcontainer/` opens the whole stack in GitHub Codespaces (or any devcontainer host) with the recording fake provider from `proofs/` in place of a model provider. Each start makes a fresh demo organization, API key and agent session; nothing is stored in the repository. The dashboard, auth and the engine share one forwarded port. CI builds the devcontainer and runs the smoke test and the README's three requests inside it.

### Security and behaviour

- Database functions are executable by `postgres` and `service_role` only; the anon key and signed-in browser sessions can no longer call them. Row-level security is on for the admin audit log, notification settings, monthly usage and webhooks.
- DLP detects GitHub, Slack and Google API tokens in addition to the existing key, JWT, private-key and card-number patterns.
- The kill switch works: `POST /v1/agent-sessions/{id}/kill` now stops the session at the gateway, and only a member of the session's organization can kill it.
- Requests refused for budget, kill switch or suspension are recorded in `request_logs`, so the audit trail covers refusals as well as completions.
- A budget is now the project's total spend. The budget worker used to move the Redis spend counter into Postgres every 60 seconds (`GETDEL`), which handed every project its whole budget again once a minute; it now copies the counter, and a counter Redis has lost is reloaded from that copy instead of starting from zero. `projects.current_spend` keeps micro-dollars (`NUMERIC(18, 6)`), and Redis evicts only keys that expire (`volatile-lru`), never the spend counters.
- Clearing a project's cache (on a budget or project change) no longer deletes its spend counter, and it now reaches every cached key of the project, not only keys made by `/management/keys`.
- Revoking a key through `/v1/api-keys` drops its cached record at once; before, a revoked key kept working for up to 24 hours. Cached key records now live 5 minutes.
- Redis holds no tenant API key in plain text: the cache, its lock and the per-project key sets are named by the key's SHA-256.
- `X-Oxy-Agent-Id` and `X-Oxy-Session-Id` are checked against the API key's organization; before, any tenant could write another tenant's ids into its own request logs. A killed session is refused from its row in Postgres even when its Redis kill flag has expired or is gone.
- Fail closed: a budget that cannot be checked is refused with 503, an unreadable kill flag is never read as "not killed", the Redis client has timeouts, and the broken Postgres fallback for budget reservations is gone. The subscription lookup on every request is removed from the request path.
- PostgREST's database password (`authenticator`) is generated on each install's first boot instead of being a constant in `db/supabase-compat.sql`; `AUTHENTICATOR_PASSWORD` sets it explicitly.
- The browser roles can no longer insert into `sso_audit_log` or `user_achievements`.
- Public text says what the code does: budgets are per project (the agent budget fields are not enforced), the in-app budget page lists only the refusal the gateway gives (402, or 503 when the budget cannot be checked), and `GET /public/status` no longer reports services it did not check.

### Removed

- The `leads` table (anyone with the public anon key could insert into it) and the add-on purchase endpoints, which charged through Stripe without turning the add-on on. Add-ons are feature flags an operator sets in `organization_add_ons`; `GET /add-ons/catalog?organization_id=` shows them.

- Growth features left from the hosted service: prompts pushing a larger plan and the worker that sent them, the annual-billing and fast-checkout flows, lead scoring, the unauthenticated `/public/metrics` endpoint (organization and sign-up counts for a landing page), and UI experiments with their conversion tracking.
- Plan prices. Plan tiers (`free`, `starter`, `growth`, `business`, `enterprise`) are quota levels an operator assigns in the database; see `docs/getting-started/free-tier.md`.
