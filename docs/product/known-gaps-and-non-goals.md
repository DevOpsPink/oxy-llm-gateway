# Known Gaps & Non-goals

## Purpose
- This page lists heuristic/best-effort behaviors, known limitations, and things Oxy explicitly does NOT guarantee.
- Use it to set expectations before you rely on a feature; see `docs/product/FEATURE_MATRIX.yml` for the canonical feature map.

## Heuristic / best-effort features
- Anomaly detection, intelligence, security score
  - What it does: heuristic signals for spikes, cost insights/forecast, configuration score (A–F).
  - Not guaranteed: not billing truth; not a monitoring/SOC/SIEM SLA; may miss or misclassify events; depends on request_logs quality and configuration.
- Cost optimizer
  - What it does: heuristic recommendations (model switch, caching, throttling) with estimated savings.
  - Not guaranteed: no guaranteed savings; estimates only; depends on data quality and pricing metadata.
- Budgets & cost-spike-auto-suspend
  - What it does: budget checks/alerts; optional heuristic spike detection that can suspend.
  - Not guaranteed: best-effort; may not stop all spend if traffic bypasses Oxy or providers change pricing.
- Local LLM
  - What it does: routes to Ollama/vLLM/custom HTTP OpenAI-compatible runtimes with guardrails applied.
  - Not guaranteed: performance/latency/quality are deployment-dependent; no SLA; compatibility depends on backend honoring OpenAI API.
- Integrations (Slack/Discord, Zapier, HubSpot)
  - What it does: outbound alerts/webhooks and CRM syncs when configured.
  - Not guaranteed: delivery depends on third parties; best-effort only; no SLA.

## Add-ons
- SSO, white-label, extended log retention, extra projects, dedicated support:
  - Per-organization feature flags the operator turns on; see `docs/features/add-ons.md`.
  - `dedicated_support` is a label only; it changes no behavior.
  - May depend on third-party services (IdP, DNS, storage, email).

## What Oxy is NOT
- Not a billing source of truth; final invoices come from providers/Stripe/ERP.
- Not a SIEM/SOC or a replacement for security operations.
- Not a sanctions/export-compliance or legal review engine.
- Not a guarantee of savings or precise cost forecasts.
- Best-effort and heuristic throughout; there is no SLA.

