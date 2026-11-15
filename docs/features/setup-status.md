# Setup Status (GA, advisory only)

API: `GET /v1/setup/status`
Dashboard: `/dashboard/setup` (Setup Wizard)

## What it returns
- Overall `completed` flag (best-effort, advisory).
- `steps[]` with ids for providers, guardrails/privacy, billing/plan, and optional SSO.
- `incomplete_required_steps` listing any required steps not completed.

## How it is used
- Intended for onboarding flows to show progress in the dashboard Setup Wizard.
- Does **not** enforce completion; purely informational/advisory.

## Limitations / non-guarantees
- Best-effort/advisory; depends on org metadata being accurate.
- Not an SLA; does not block API usage; enforcement must be handled elsewhere.
- Optional SSO does not prevent completion.

