# Kill Switch

The kill switch provides a best-effort mechanism to stop or pause agent sessions before they cause further cost or unwanted actions.

## What this feature does
- Issues kill/pause commands via `/v1/agent-sessions/{id}/kill`.
- Marks the session as terminated (Redis/DB flag) and blocks further requests for that session in the control hook.
- Streaming paths check the termination flag and stop best-effort mid-stream.
- Audited via admin audit logs when enabled.

## What this does NOT guarantee (best-effort, not an SLA)
- No latency guarantee; “fast” is a target, not an SLA.
- Cannot halt processes running entirely outside Oxy’s control paths.
- Does not roll back actions already completed by the agent.

## How it works (code-level)
- Control path uses Redis/DB flags to mark sessions as killed/paused.
- Central control hook rejects new requests when a session is terminated.
- Streaming loop checks termination flag and stops emitting chunks best-effort.
- Pair with budgets/alerts for automatic triggers (see anomaly detection/cost spikes).

## Configuration
- Ensure session IDs are propagated with requests so kill signals can take effect.
- Use budgets/alerts to trigger kill/pause based on spend spikes where appropriate.

## API
- `POST /v1/agent-sessions/{id}/kill` — request kill/pause.
- `GET /v1/agent-sessions/{id}` — verify status.

## Limitations / known gaps
- Kill requires the agent/tooling to route through Oxy; external processes may not stop immediately.
- No guarantee of downstream tool cancellation; integrate app-level guards as needed (best-effort).
- Best-effort timing only; no SLA on how fast streams stop.
