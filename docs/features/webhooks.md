# Webhooks

Send selected events to your endpoints.

- Scope: registration and delivery are implemented in `packages/engine/routes/notifications_v1.py` and `routes/public.py`.
- Events: delivery includes event metadata; payloads are best-effort and should be validated on receipt.
- Configuration: register endpoints via the API; secure them with auth/secret validation on your side.
- Reliability: delivery is retried best-effort; use idempotent handlers.
- Not a billing system: payloads are informational; do not treat them as invoices.
