# Loop Detection (Heuristic)

- Detects repeated prompts for the same agent in a short window.
- Heuristic only; no guarantees.
- Auto-suspend uses the same agent status fields as kill-switch/budgets.

## How it works
- Key = `org_id:agent_id:normalized_prompt_hash`.
- Normalization: lowercase, trim, collapse whitespace, strip obvious timestamps/IDs; hash via SHA-256 (short hex).
- Window: N identical keys within M seconds (default N=5, M=10s) → loop anomaly.
- Privacy: if `privacy_mode=zero_prompt_logging` or prompt is absent, loop detection is skipped (no prompt → no loop key).

## Actions
- Log/alert always.
- Optional auto-suspend when `auto_suspend_on_loop` is enabled on the agent.
- Suspension uses `status=suspended`, `suspend_reason=loop_detected`, `suspended_until` (duration configurable).

## Configuration
- Env defaults: `LOOP_THRESHOLD` (5), `LOOP_WINDOW_SECONDS` (10), `LOOP_SUSPEND_MINUTES_DEFAULT` (60).
- Agent flags: `auto_suspend_on_loop`, `loop_suspend_duration_minutes` (reuse existing agent status fields).

## Interaction with budgets / kill-switch
- Suspension shares the same agent status fields consumed by kill-switch/budgets middleware.
- No new schema; uses existing request_logs data and Redis window counters.
