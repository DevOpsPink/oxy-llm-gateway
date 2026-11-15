# DLP Checks (Deterministic, Best-Effort)

DLP checks run before provider calls to catch obvious secrets. They are regex-based and best-effort (not exhaustive, not AI-driven).

## What we check
- Card-like numbers (e.g., 16-digit patterns resembling payment cards)
- Emails
- Obvious API key-like strings (e.g., `api_key=...`, `sk-...`)
- Select other high-signal patterns defined in code (`DLP_PATTERNS`)

## Where checks run
- Pre-provider in `/v1/chat/completions` request path.
- Tool call arguments are scanned and can be redacted before logging.

## Modes
- `off`: skip DLP scanning.
- `log`: detect and log; request proceeds.
- `block`: detect, log, and block with a structured error.

## How to configure
- Org-level `dlp_mode` (off/log/block). Default is `block`.
- Ensure headers include session/agent IDs so blocks are attributed.
- Combine with privacy modes and audit logging for traceability.

## How to verify quickly
- Set `dlp_mode=block` for the org and send a prompt containing a fake secret (e.g., `sk-test-123`).
- Expect a structured error indicating DLP block; request should not reach the provider.
- Switch to `log` and confirm the request proceeds but a DLP event is logged.

## What this does NOT guarantee (best-effort, not an SLA)
- No completeness guarantee; patterns are deterministic and limited; best-effort only.
- No compliance certification; use as one layer of defense.
- Effectiveness depends on routing traffic through Oxy; external logs/apps are not covered.

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.
