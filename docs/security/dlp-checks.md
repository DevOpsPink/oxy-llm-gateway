# DLP Checks (Deterministic, Best-Effort)

DLP checks run before provider calls to catch obvious secrets. They are regex-based and best-effort (not exhaustive, not AI-driven).

## What we check
The patterns in `DLP_PATTERNS` (`packages/engine/core.py`), and nothing else:
- OpenAI keys (`sk-proj-` or `sk-` followed by 48 letters and digits) and Anthropic keys (`sk-ant-api03-` and 95 more characters)
- AWS access key ids (`AKIA` and 16 more)
- Stripe live secret keys (`sk_live_` and at least 24 more)
- JWTs (three dot-separated base64url parts)
- PEM private key headers (`-----BEGIN ... PRIVATE KEY-----`)
- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` and 36 more, or `github_pat_`)
- Slack tokens (`xox` followed by a type letter and a dash)
- Google API keys (`AIza` and 35 more)
- Card-like numbers (Visa, Mastercard, American Express, Diners, Discover and JCB layouts, with or without spaces or dashes)

Email addresses are not checked, and neither is a short placeholder such as `sk-test-123`: a key-like string must have the full length of the real format to match.

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
- Set `dlp_mode=block` for the org and send a prompt containing a fake secret of a real format, generated on the spot so no token-shaped string sits in a file: `python3 -c "import secrets, string; print('ghp_' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(36)))"`. The README's Codespace requests do the same.
- Expect HTTP 451 with error code `DLP_BLOCKED` and the pattern's name in the message; the request does not reach the provider.
- Switch to `log` and confirm the request proceeds but a DLP event is logged.

## What this does NOT guarantee (best-effort, not an SLA)
- No completeness guarantee; patterns are deterministic and limited; best-effort only.
- No compliance certification; use as one layer of defense.
- Effectiveness depends on routing traffic through Oxy; external logs/apps are not covered.

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.
