# API Keys (Dashboard + API)

- Manage organization/project API keys from the dashboard (create/revoke; secrets shown once).
- Backed by `POST/GET/DELETE /v1/api-keys` APIs.
- Keys are controlled by the organization that owns them; rotate and scope them per your policy.

Limitations & disclaimers
- Best-effort tooling; not a security certification or SLA.
- Keys and secret storage are your responsibility; rotate regularly.

For general caveats and non-goals, see `docs/product/known-gaps-and-non-goals.md`.

