# Oxy Engine (gateway backend)

FastAPI service that powers the Oxy gateway. Feature status and claims are governed by `docs/product/FEATURE_MATRIX.yml`.

## Feature summary (aligned to Feature Matrix)
- GA (core): kill switch, per-agent/org budgets with cost spike auto-suspend, loop detection (heuristic), rate limiting/security headers, DLP checks, privacy modes/logging, response caching, cost attribution & CSV export, webhooks.
- GA (analytics/insights): intelligence overview & security score (heuristics), cost optimizer recommendations (heuristics), Slack/Discord alerts (best-effort), Zapier outbound triggers (best-effort).
- Beta/preview: geo/IP protections, key rotation, response/audit logs retention add-on, local LLM support, referral credits, agent templates, hubspot integration, SSO/white-label/long-term audit logs/dedicated support add-ons.
- Planned: —

Heuristics/estimates: intelligence, optimizer, forecasts, and scores are best-effort and not billing or security guarantees.

## Development
- Create venv and install deps:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```
- Run core tests from repo root: `make test-core`
- Smoke healthcheck (engine running on :8000): `OXY_API_KEY=... sh scripts/dev_smoke.sh`

## Endpoints (selected)
- Data plane: `/v1/chat/completions` (proxy with budgets, rate limits, optional caching/DLP/privacy). Healthcheck fast-path documented in `tests/test_healthcheck.py`.
- Control/analytics: budgets (`/v1/billing/overview`), privacy (`/v1/privacy`), attribution (`/v1/attribution/summary`), exports (`/v1/exports/requests.csv`), intelligence (`/v1/intelligence/overview`), optimizer (`/v1/cost-optimizer/recommendations`).

## Safety notes
- No uptime/latency guarantees unless contractually agreed.
- Budgeting, spike detection, and loop detection are best-effort; configuration-dependent.

## License
Proprietary; see root `LICENSE`.
