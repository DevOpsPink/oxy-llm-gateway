# Cost Spike Auto-Suspend (Heuristic)

- Detects spend spikes vs historical baseline and can auto-suspend using the same status fields as budgets/kill-switch.
- Heuristic only; estimates based on request_logs. Not a billing source of truth.

## How it works
- Baseline: average hourly spend over the last 30 days (`request_logs`).
- Current: last 1 hour spend.
- Multiplier thresholds (defaults): Warning 5x, Urgent 10x, Critical 50x, Auto-suspend 100x.
- Severity determines alerting; auto-suspend triggers at the suspend threshold.

## Actions
- Log/alert for WARNING+.
- Auto-suspend (if org `auto_suspend_on_cost_spikes` is true) sets:
  - org: `status=suspended`, `suspend_reason=cost_spike`, `suspended_until` (configurable minutes),
  - project: `is_suspended=true`, `suspension_reason=Automatic suspension: spending spike detected`, `suspended_until`.
- Uses same paths checked by budgets/kill-switch middleware; no parallel suspension path.

## Configuration
- Env: `THRESHOLD_WARNING`, `THRESHOLD_URGENT`, `THRESHOLD_CRITICAL`, `THRESHOLD_SUSPEND`, `COST_SPIKE_SUSPEND_MINUTES` (default 60).
- Org flag: `auto_suspend_on_cost_spikes` (existing).

## Caveats
- Heuristic/estimate only; depends on request_logs completeness and timeliness.
- If baseline data is sparse, a minimum baseline guard is applied.
