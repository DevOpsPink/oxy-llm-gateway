# Key Concepts

Oxy is an AI control plane that proxies requests to cloud and local LLMs, with controls for budgets, security, and observability. This page defines the main objects and controls as implemented today.

## Organizations and projects
- **Organization**: top-level container for users, budgets, audit logs, providers, and settings.
- **Project / API keys**: scoped credentials used for data-plane requests (`/v1/chat/completions` etc.). Keys are hashed in storage.

## Providers
- Cloud providers: OpenAI, Anthropic, Google (Gemini) via configured keys/env.
- Local providers: Ollama, vLLM, custom HTTP runners; availability depends on your deployment/config.
- Provider enablement is configured via management endpoints and environment flags; secrets live in environment/Supabase, not in the UI database.

## Requests and sessions
- **Data plane**: `/v1/chat/completions` proxied to configured provider with budget checks, logging (metadata by default), optional caching, and anomaly hooks.
- **Agent sessions**: tracked via agent/session endpoints; can be paused/killed to stop further tool use or spend. “Kill switch” is best-effort; no latency guarantees.

## Budgets and alerts
- Budgets: a spend cap per project, reserved atomically in Redis before a request is forwarded and mirrored to Postgres. Agents have budget fields, but the request path enforces the project's cap only.
- Alerts and auto-suspend thresholds are configurable; defaults exist but are not contractual.

## Privacy modes (logging)
- **zero_prompt_logging**: metadata only (no prompt/response text).
- **metadata_only**: extended metadata (no prompt/response text).
- **debug_full**: may log prompts/responses for troubleshooting; use only in non-sensitive contexts.
- Retention is policy-driven and deployment-specific; no fixed retention guarantee.

## Security controls
- DLP-style checks (regex-based) on request payloads/tool outputs when enabled; not a full enterprise DLP.
- Rate limiting and basic DDoS protection via middleware; pair with your WAF for production.
- Security headers (HSTS/CSP/XSS) are supported when configured in middleware/proxy.
- Key rotation support via middleware; rotation cadence is policy-driven.
- Geo-blocking and IP-based controls available where configured.

## Analytics and attribution
- Cost attribution tags (customer/team/feature) flow through requests and into exports.
- CSV exports for audit/compliance; retention is policy-driven.
- Intelligence/insights provide anomaly lists, spend projections, and a heuristic security score based on current controls.

## Plan tiers and add-ons
- Each organization has a plan tier (`free`, `starter`, `growth`, `business`, `enterprise`): a set of quotas the operator assigns in the database. See `docs/getting-started/free-tier.md`.
- Add-ons are per-organization feature flags (SSO/SAML, white-label, extended log retention, extra projects) the operator turns on in the database. See `docs/features/add-ons.md`.

## Status and limits
- Default plan limits are defaults, not commitments; tune them for your deployment.
- No SLAs or performance guarantees.
