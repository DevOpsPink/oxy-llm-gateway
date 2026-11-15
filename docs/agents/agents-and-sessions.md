# Agents and Sessions

Oxy tracks agent activity and sessions to give you control over running workloads.

## What this feature does
- Provides agent/session endpoints to list, inspect, and manage active runs.
- Associates requests with agents/sessions for budgeting, anomaly detection, and auditing.
- Supports per-session kill/pause actions (see kill-switch).

## What this does NOT guarantee (best-effort, not an SLA)
- No guarantee of instant termination; kill/pause is best-effort via control paths.
- No automatic recovery of user code; you must handle retries and cleanup.

## API (core endpoints)
- `GET /v1/agent-sessions` — list sessions (filters may include status/time).
- `GET /v1/agent-sessions/{id}` — session detail.
- `POST /v1/agent-sessions/{id}/kill` — request kill/pause for a session.

## Configuration
- Ensure budgets and privacy modes are set for the org/project so sessions inherit the right controls.
- Use tagging (customer/team/feature) to align sessions with cost attribution.

## Limitations / known gaps
- Kill/pause depends on control hooks; if an agent runs outside Oxy’s reach, termination may be delayed or ineffective.
- No autoscaling or orchestration of agents; Oxy provides control and observability, not scheduling.***
