# Loop Detection and Anomalies

Oxy includes workers that monitor for loops, stuck sessions, and unusual spend/activity patterns.

## What this feature does
- Agent anomaly detector looks for infinite loops/stuck sessions and can alert or pause.
- Cost anomaly detector can alert and optionally auto-suspend on extreme spend spikes.
- Notifications can be sent via configured channels (email; Slack planned).

## What this does NOT guarantee
- No perfect detection of all loops or anomalies; heuristics are best-effort.
- No guarantee of instant response; worker cadence and control-path latency apply.

## Configuration
- Enable and tune anomaly thresholds (e.g., multiples of baseline spend) in worker settings.
- Configure notification channels (email required; Slack planned/optional if integrated).
- Pair with budgets and kill switch for stronger enforcement.

## Limitations / known gaps
- Heuristics may produce false positives/negatives.
- Auto-suspend requires agents to respect Oxy control paths; external workloads may keep running.***
