# Quickstart

This guide takes a fresh clone of Oxy to a running gateway in roughly five minutes. It uses the bundled `docker-compose.yml` stack — no cloud accounts required.

## What you get

Fourteen containers on a local docker network:

| Service | Port (host) | Purpose |
|---|---|---|
| `ui` | 3000 | Next.js dashboard |
| `engine` | 8000 | FastAPI gateway exposing `/v1/chat/completions` |
| `nginx-postgrest` | 8080 | Path-shape adapter — `/auth/v1/*` to GoTrue, `/rest/v1/*` to PostgREST |
| `gotrue` | (network) | Supabase Auth server (signup / login / sessions) |
| `postgrest` | (network) | REST-over-Postgres for the engine and the UI |
| `postgres` | (network) | Source of truth — schema + RLS + auth + vault |
| `redis` | (network) | Cache, atomic budget operations, rate limits |
| `mailpit` | 8025 | Catches sign-in mail locally; open it to click your magic link |
| `worker-*` | (network) | Six background workers: logs, budgets, webhook retries, cost and agent anomalies, intelligence |

The engine and UI defaults already point at the local stack; nothing else needs configuring for the basic flow.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2) on macOS, Windows, or Linux
- ~3GB RAM headroom for the stack
- An LLM provider API key if you want to send real requests through the gateway (otherwise the healthcheck fast-path works without one)

## Run it

```bash
git clone https://github.com/heyvaldemar/oxy-llm-gateway.git
cd oxy-llm-gateway
docker compose up -d --build --wait
```

The first run builds the engine and UI images, which takes a few minutes. After that, first boot takes about a minute while images pull, Postgres applies the schema (`db/supabase-compat.sql` then `db/schema.sql`), and GoTrue runs its 54 auth migrations. Subsequent boots are 5-10 seconds.

To follow the engine's logs:

```bash
docker compose logs -f engine
```

## Verify each layer

```bash
# Engine health (Redis + Postgres reachability)
curl http://localhost:8000/health
# → {"status":"healthy","redis":"healthy","supabase":"healthy", ...}

# GoTrue health (auth server)
curl http://localhost:8080/auth/v1/health
# → {"name":"GoTrue", ...}

# UI landing page
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# → 200

# Everything end to end: magic link, onboarding, API key, gateway
bash scripts/stack_smoke.sh
# → All smoke checks passed.
```

If these succeed, the stack is good.

## Sign up and explore

1. Open <http://localhost:3000/login> in a browser.
2. Enter any email address and send yourself a magic link.
3. Open <http://localhost:8025>: Mailpit holds the mail locally. Click **Log In** in it.
4. Finish onboarding. Add a provider key now or later in **Settings**; until one is connected the dashboard shows demo data.
5. In the dashboard you can:
   - Create an API key under **Settings → API Keys**
   - Try a chat completion under **Playground**
   - Inspect request logs, budgets, and intelligence panels

## Send a real LLM request

Connect a provider key in onboarding or **Settings**. For an org-wide key instead, put `OPENAI_API_KEY=...` (or `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`) in `packages/engine/.env` with an editor and recreate the engine with `docker compose up -d engine`.

Then issue a request through the gateway with the `OXY_API_KEY` from your dashboard:

```bash
export OXY_API_KEY="oxy_live_..."

curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $OXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role": "user", "content": "Say hi in five words."}]
  }'
```

The response follows the OpenAI chat-completions schema. Budget, cost attribution, and request-log rows are written to Postgres asynchronously.

## Common gotchas

- **Port 3000 / 8000 / 8080 in use** — stop whatever's bound or remap in `docker-compose.yml` (`ports:`).
- **`oxy_postgres_data` volume from an old version** — wipe with `docker compose down -v && docker compose up`. This destroys all data, including any users you signed up.
- **GoTrue migrations fail on a non-empty schema** — the compat shim and GoTrue's own migrations only coexist on a fresh Postgres volume. If you change `db/supabase-compat.sql`, wipe `oxy_postgres_data` before restarting.
- **`Connection refused` from inside the UI container** — the UI uses `INTERNAL_SUPABASE_URL=http://nginx-postgrest:8080` for SSR fetches. Make sure `nginx-postgrest` is `healthy` (`docker compose ps`); the UI service depends on it.

## Stop the stack

```bash
docker compose down            # stop containers, keep volumes
docker compose down -v         # stop containers AND wipe volumes (fresh start next time)
```

## Where to go next

- `docs/security/privacy-modes.md` — switch between metadata-only, debug, and zero-prompt-logging modes
- `docs/agents/agents-and-sessions.md` — concepts for agent runs, the kill switch, and budgets
- `docs/providers/local-llm.md` — point the gateway at Ollama / vLLM / a custom OpenAI-compatible endpoint
- `DEPLOY.md` — production setup notes (hosted Supabase option, TLS via Caddy, secrets management)
- `SECURITY.md` — cryptography, RLS, atomic budget operations, audit and incident response

## Honest scope reminder

Oxy is a reference implementation. Everything works but nothing is contractually guaranteed — budgets, latency, retention, and security signals are all best-effort. Review `SECURITY.md` and `db/supabase-compat.sql` before pointing the stack at anything you care about.
