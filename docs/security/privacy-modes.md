# Privacy Modes

Oxy supports configurable logging modes to control what is stored. Defaults are metadata-focused; text logging is opt-in for debugging.

## Modes
- **zero_prompt_logging**: Only metadata (timestamps, counts, latency, tags). No prompt/response text stored.
- **metadata_only**: Extended metadata; still no prompt/response text.
- **debug_full**: May log prompts/responses for troubleshooting. Requires `OXY_DEBUG_FULL_LOGS` enabled and explicit privacy_mode=debug_full; use only in non-sensitive contexts.

## What this does NOT guarantee (best-effort, not an SLA)
- No universal “never logs anything” guarantee; behavior depends on the selected mode and your deployment; best-effort only.
- Retention is policy-driven; no fixed retention term or SLA is promised (best-effort).

## Configuration
- Set `privacy_mode` via privacy endpoints (`/v1/privacy`) or UI settings.
- `debug_full` text capture is gated by env `OXY_DEBUG_FULL_LOGS`; leave it off in production.
- Choose mode per org/project according to data sensitivity.
- Combine with DLP checks and access controls for sensitive environments.

## How to verify quickly
- Set `privacy_mode` to `zero_prompt_logging` and send a prompt via `/v1/chat/completions`; check `request_logs`/exports to confirm prompt/response snapshots are null.
- Switch to `metadata_only` and verify only metadata is present in logs/exports.
- In `debug_full` (non-prod), confirm snapshots appear only when the env flag is enabled.

## Cookies and the banner
- Only essential cookies (auth/security) are used by default.
- No third-party advertising or marketing trackers are used.
- The cookie banner is informational and non-blocking; it discloses essential cookies and lets users acknowledge the notice.
- Dismissing the banner stores an acknowledgment flag; it does not change privacy modes or logging scope.

## Limitations / known gaps
- If applications log data outside Oxy, modes cannot control that.
- Debug modes can capture sensitive text; restrict access and use only when necessary.***

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.
