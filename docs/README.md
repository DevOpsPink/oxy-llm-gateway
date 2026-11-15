# Oxy Documentation

This documentation set reflects the current Oxy implementation in `packages/engine` and `packages/ui`. It intentionally avoids over-promises: every feature description matches code, configuration, or behaviour that is actually present in the repository.

## Scope and principles

- Describe only features that exist in code or are explicitly surfaced in the product.
- If a feature is optional, configurable, or limited, we say so.
- No hard guarantees (latency, retention, savings, uptime). Everything is best-effort.
- Privacy and security claims are conservative and tied to actual controls (e.g., zero-prompt-logging mode, rate limits, geo-blocking, audit logs).

## Navigation

- Getting started: setup, quickstart, key concepts.
- Providers: cloud and local LLM configuration.
- Agents: sessions, kill switch, budgets, loop detection.
- Features: response caching, webhooks, other gateway capabilities.
- Security: privacy modes, audit logs, DLP checks, key rotation, IP protections, security score.
- Analytics: cost attribution and CSV exports (finance reporting).
- Add-ons: per-organization feature flags for SSO/SAML, white-label, extended log retention and extra projects (`docs/features/add-ons.md`).
- Plan limits: default quotas per plan tier (`docs/getting-started/free-tier.md`).
- Recipes: practical guides for local and hybrid deployments, cost attribution workflows.

## Quick links

- Response Caching: `docs/features/response-caching.md`
- Cost Attribution & CSV Export: `docs/analytics/cost-attribution.md`
- Privacy Modes / Logging: `docs/security/privacy-modes.md`
- Rate Limiting / Security Headers / IP Protections: `docs/security/ip-protection.md`
- Webhooks: `docs/features/webhooks.md`
- Recipes: cloud, local, hybrid setups
  - `docs/recipes/cloud-starter.md`
  - `docs/recipes/local-ollama-agent.md`
  - `docs/recipes/hybrid-stack.md`

If you find any mismatch between these docs and the code, prefer the code and open an issue.
