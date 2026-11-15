# Budgets and Alerts

Oxy enforces budgets and can emit alerts or auto-suspend when spend exceeds thresholds.

## What this feature does
- Budget checks (Redis/DB) before forwarding requests to providers.
- Configurable alerts and optional auto-suspend for extreme spikes.
- Supports tagging by customer/team/feature to align with cost attribution.

## What this does NOT guarantee (best-effort, not an SLA)
- No guarantee of exact spend ceilings if requests bypass Oxy or providers change pricing; best-effort only.
- Thresholds are policy/config driven; defaults are not contractual.

## Configuration
- Set budget limits at org/project (and optionally agent) levels.
- Configure alert thresholds and auto-suspend policies (e.g., via cost anomaly settings).
- Ensure Redis/DB connections are reliable; budget checks depend on them.

## API (representative)
- Data-plane checks happen on `POST /v1/chat/completions`.
- Management endpoints for budgets/alerts live under `/v1/` (see billing/usage routes in code).

## Limitations / known gaps
- Auto-suspend is best-effort; if control signals can’t reach an agent, spend may continue briefly.
- Provider pricing changes are not auto-detected; update configs to keep budgets accurate.***
