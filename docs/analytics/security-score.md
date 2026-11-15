# Security Score (Heuristic)

- API: `GET /v1/intelligence/security-score` (authenticated API key).
- Also included inside `GET /v1/intelligence/overview`.
- Heuristic/advisory only — not a certification or guarantee.

## How to verify quickly
- Ensure budgets/DLP/privacy/rate limits are configured for the org.
- Call `GET /v1/intelligence/security-score` or `/v1/intelligence/overview` and check:
  - `score` between 0–100, `grade` in A–F.
  - Turning off controls (e.g., no budgets or DLP off) should lower the score.
  - Enabling more controls should not worsen the grade for the same input.

## Deterministic scoring table
Starting at 100, clamped to [0,100]:
- Budgets configured: +10 if any project has a budget, otherwise -20.
- DLP enabled: +5 if enabled, otherwise -25.
- Privacy mode: `zero_prompt_logging` +10; `metadata_only` +5; `debug_full` -15; unknown -10.
- Key rotation age: <=90 days +5; 91–180 days -5; >180 days -15; unknown -10.
- Rate limits enabled: +5 if >0, otherwise -20.
- Response caching enabled: +3 if on, otherwise -5.
Grades: A >=90, B >=80, C >=65, D >=50, else F.

## How to interpret / improve
- Enable budgets to avoid burn risk.
- Turn on DLP scanning and prefer stricter privacy modes where possible.
- Rotate keys regularly (≤90 days).
- Enable rate limits and response caching.
- Review `details[]` for control-specific points and suggested action.

## Data sources
- `organizations.settings` for DLP, privacy mode, rate limits, caching flags.
- `projects` for budget presence.
- `api_keys` for `last_rotated_at` (worst age used).

## Prerequisites
- Cost/security settings configured (budgets, DLP, privacy mode, rate limits).
- API keys rotated periodically to avoid age penalties.

## Limitations
- Heuristic only; not a security guarantee or compliance proof (SOC2/ISO/etc.).
- Depends on configuration; an "A" does not imply fully secure.
- Does not replace pen tests, SIEM/SOC, or security reviews.
 - Not billing truth; use cost attribution/exports for audit-grade cost data.

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.
