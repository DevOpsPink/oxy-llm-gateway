# Cost Attribution & CSV Export

Tag requests and export spend for finance workflows.

- What it does: aggregates request costs by tags (e.g., customer, team, feature) and supports CSV exports.
- API: `/v1/attribution/summary` (see `packages/engine/routes/attribution_summary.py`) and CSV via `packages/engine/routes/exports.py`.
- Data source: request logs (`request_logs`) and attribution tables (`request_attribution`, `cost_attribution_tags`).
- Tags: set `cost_tags` when creating requests (customer/team/feature). Attribution summary groups by stored tags.
- CSV export: includes timestamps, provider/model, tokens, cost, and tags. Use date filters to limit range.
- Guarantees: best-effort aggregation; accuracy depends on correct tagging and provider usage data.
