# Intelligence Layer (Overview)

- Surfaces heuristic anomalies, cost insights, forecast, and heuristic security score.
- API: `GET /v1/intelligence/overview` (authenticated API key).
- Outputs are heuristic/estimates only; not a billing source of truth or monitoring SLA.

## How to verify quickly
- Send a few requests through `/v1/chat/completions` so `request_logs` has data.
- Call `GET /v1/intelligence/overview` and confirm:
  - `anomalies[]` is empty for normal traffic.
  - `cost_insights.top_models/top_projects` are present.
  - `forecast.month_to_date_cost_usd` is non-negative.
  - `security_score.grade` is one of A–F.

## What counts as an anomaly
- Cost spike vs 7-day rolling mean (hourly), threshold multiplier `3x`.
- Request volume burst vs 7-day rolling mean, threshold multiplier `5x`.
- Budget burn alerts reuse budget projections from the cost pipeline.
- Anomalies are stored in `anomaly_alerts` and returned via the overview.
- Heuristic only; may miss incidents or flag false positives. Data quality (request_logs, privacy mode, retention) drives accuracy.

## Data sources
- `request_logs` for spend/volume baselines and projections.
- `projects` (budget limits) for burn warnings.
- `anomaly_alerts` table for surfaced events.

## Output shape (overview)
- `anomalies[]`: recent alerts with type, severity, detected_at, and estimated impact where available.
- `cost_insights`: top models/projects and month-to-date spend.
- `forecast`: month-to-date + projected end-of-month (linear projection, estimates only).
- `security_score`: heuristic grade (see `security-score.md`).

## Limitations
- Heuristic/advisory only; not billing truth or a monitoring/SOC SLA.
- Accuracy depends on request_logs quality, retention, privacy modes, budgets, and configured controls.
- Forecasts are simple projections; anomalies/score may miss or misclassify events.
 - Does not replace cost attribution exports; use `/v1/exports/requests.csv` or attribution summaries for audit-grade data.

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.

## Prerequisites
- Cost pipeline populated (`request_logs`).
- Budgets configured to enable burn alerts.
- DLP/rate limits/privacy modes configured to improve security score context.
