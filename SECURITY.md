# Security Policy

## Supported versions

The `main` branch. Fixes land there; tags mark releases.

## Reporting a vulnerability

Report privately through GitHub: [**Security → Report a vulnerability**](https://github.com/heyvaldemar/oxy-llm-gateway/security/advisories/new) on this repository. Email to connect@valdemar.ai also works. The process is described at [heyvaldemar.com/security](https://heyvaldemar.com/security/).

You can expect an acknowledgment within 7 days. This project does not operate a bounty program; researchers who submit valid, responsibly disclosed reports receive public credit in the changelog.

## What Oxy is, and is not

Oxy is Apache 2.0 software and a reference implementation, not a hosted or certified service. No SOC 2, ISO 27001, HIPAA or similar certification applies to this code. Whoever deploys it is responsible for that deployment, its secrets and its data.

## How Oxy handles secrets and data

- **Provider API keys** are stored through `vault.create_secret`. On the bundled self-hosted stack that is the pgcrypto AES shim in `db/supabase-compat.sql`, keyed by `SUPABASE_VAULT_KEY`; it is weaker than Supabase's pgsodium-backed Vault. On a hosted Supabase project, Supabase Vault is used.
- **Oxy API keys** are stored as SHA-256 hashes (`api_keys.key_hash`); only the prefix is shown after creation.
- **Tenant isolation** relies on Postgres row-level security policies in `db/schema.sql`.
- **Prompt logging** follows the organization's privacy mode: `metadata_only` by default, `zero_prompt_logging` or `debug_full` on request. See `docs/security/privacy-modes.md`.
- **DLP** is regex-based: card numbers, API-key-like strings and email addresses are detected before a request leaves the gateway. It is a heuristic, not a guarantee. See `docs/security/dlp-checks.md`.
- **Cached responses** in Redis are encrypted with Fernet (`security_utils.py`).
- **Budgets** are reserved and settled with atomic Redis Lua scripts, so concurrent requests cannot overspend a cap. A budget that cannot be checked (Redis down) is not spent: the request is refused with 503 and recorded.
- **Agent and session headers** (`X-Oxy-Agent-Id`, `X-Oxy-Session-Id`) are checked against the API key's organization; another tenant's ids are refused with 403. A killed session is refused whether or not Redis still holds its kill flag: the session's row in Postgres decides.
- **Oxy API keys in Redis**: the cache is named by the key's SHA-256 and the key itself is encrypted inside the record; no key appears in Redis in plain text. Revoking a key drops its cached record at once.

## Local defaults are for local use only

`docker-compose.yml` ships development values: the JWT secret and the anon and service-role JWTs signed with it, `SUPABASE_VAULT_KEY`, the Postgres and Redis passwords, and auto-confirmed sign-ups with mail caught by Mailpit. That is why it publishes every port on 127.0.0.1 only. Before the stack is reachable by anyone else:

1. Set your own `SUPABASE_JWT_SECRET` and sign new anon and service-role keys with it.
2. Set `SUPABASE_VAULT_KEY`, `POSTGRES_PASSWORD` and `REDIS_PASSWORD`. PostgREST's own database password is generated on each install's first boot; set `AUTHENTICATOR_PASSWORD` to choose it instead.
3. Point GoTrue at a real SMTP server and set `GOTRUE_MAILER_AUTOCONFIRM` to `false`.
4. Serve everything over TLS; `docker-compose.prod.yml` and the `Caddyfile` show one way.

`DEPLOY.md` walks through a deployment others can reach.

## Credentials in this repository

The repository holds no real credentials. The JWTs in `docker-compose.yml` are signed with the published development secret. Key-shaped strings in tests and UI placeholders are fixtures: the example key from the AWS documentation and obviously fake `sk-…` strings.
