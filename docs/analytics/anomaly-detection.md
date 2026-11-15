# Anomaly Detection (Heuristic)

API: `GET /v1/intelligence/overview` (anomalies section)

## What it does
- Flags potential cost/volume spikes and budget burn risks versus recent baselines (e.g., 1h vs 7d).
- Uses heuristics over `request_logs` and related cost data; surfaced via the Intelligence overview.
- Alerts are stored in `anomaly_alerts` and include type, severity, detected_at, description, and optional impact.

## How to use
- Ensure `request_logs` are populated for your organization.
- Call `GET /v1/intelligence/overview` with an authenticated API key; inspect `anomalies[]`.
- In the UI, view anomalies in the Intelligence section (when enabled in your deployment).

## How to verify quickly
- Send a small baseline of normal requests; verify `anomalies[]` is empty.
- Send a brief spike (e.g., many rapid requests or higher cost) and re-call `/v1/intelligence/overview`; expect at least one `cost_spike` or volume anomaly entry.
- Confirm `severity` and `detected_at` are populated.

## Limitations
- Heuristic-only; may miss incidents or produce false positives.
- Accuracy depends on request_logs completeness, retention, privacy modes, and budgets configuration.
- Not a monitoring/SOC SLA; advisory signals only.

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.

