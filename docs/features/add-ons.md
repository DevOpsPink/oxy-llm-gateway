# Add-ons

Add-ons are per-organization feature flags. Each active row in `organization_add_ons` (one per `add_on_id`, `canceled_at` empty) turns one capability on for that organization. `core/addons.py` reads the flags; the routes and workers below check them.

## Enabling an add-on

- Insert a row into `organization_add_ons` for the organization with the `add_on_id` below (columns in `db/schema.sql`). Set `canceled_at` to turn it off again. Nothing in Oxy sells or bills add-ons.
- `GET /add-ons/catalog?organization_id=<id>` lists the flags with `enabled` for that organization; the caller must be an active member of it.

## The flags

| `add_on_id` | What checks it | Effect |
|---|---|---|
| `sso` | `POST /auth/sso/configure` (`routes/sso.py`) | SSO configuration is refused with 403 until the flag is on |
| `white_label` | `POST /v1/org` (`routes/org_v1.py`) | Changing `logo_url` is refused with 403 until the flag is on |
| `audit_logs` | log retention worker (`workers/log_retention.py`) | Request-log retention uses `ADDON_AUDIT_LOG_RETENTION_DAYS` instead of the organization's own window, clamped to 7–2555 days |
| `extra_project` | project creation (`main.py`) | The plan's project cap grows by `EXTRA_PROJECT_ADDON_INCREMENT`, never above `PROJECT_HARD_MAX` |
| `dedicated_support` | nothing in code | A label only; it changes no behavior |

## SSO

With the `sso` flag on, an owner or admin registers the organization's email domain and identity provider through `POST /auth/sso/configure`; `POST /auth/sso/lookup` resolves a login email to its provider, `POST /auth/sso/callback` completes the sign-in, and `GET /auth/sso/status/{organization_id}` reports the configuration. The identity provider, its certificates and its metadata are yours to run and rotate; a misconfigured provider blocks SSO logins, so keep a password-based admin account.

## Limits

- Retention and project caps are bounded by the clamps above; nothing is unlimited.
- Retention deletes old `request_logs`; it does not archive them elsewhere.
- White-label covers the organization logo in the dashboard; it does not rewrite emails or system notices.

For general caveats, see `docs/product/known-gaps-and-non-goals.md`.
