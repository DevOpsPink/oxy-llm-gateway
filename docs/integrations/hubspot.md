# HubSpot Integration (GA, best effort)

What we sync (best effort, outbound only)
- Contacts: email, name, company, job title, lead source and score fields, signup timestamp.
- Deals: subscription events (plan, amount) and cancellations.
- Notes: subscription and cancellation annotations.
- PII is minimized; only configured fields are sent.

Prerequisites / config
- `HUBSPOT_API_KEY`, `HUBSPOT_ENABLED=true`.
- Optional: `HUBSPOT_MAX_RETRIES` (default 3), `HUBSPOT_BACKOFF_SECONDS` (default 0.5s).
- Integration is outbound-only; Oxy is not a CRM.

Failure semantics
- Best-effort sync. HubSpot outages or auth failures do not block billing/intelligence flows.
- Transient errors are retried with bounded backoff; auth failures stop retrying.
- Tokens are never logged.

Privacy / data minimization
- Sync only selected metadata fields.
- You can disable the integration via `HUBSPOT_ENABLED=false`.
- Do not include sensitive payloads in custom fields.

Troubleshooting
- 401/403: check API key/scopes; retries stop on auth errors.
- 5xx/timeouts: retried up to `HUBSPOT_MAX_RETRIES`; otherwise logged as best-effort failure.
- No wallets or payments are processed by Oxy; Stripe remains the payments processor elsewhere.
