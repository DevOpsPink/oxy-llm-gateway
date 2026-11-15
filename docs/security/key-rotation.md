# Key Rotation (warnings + optional enforcement)

What it tracks
- API key age based on `last_rotated_at` (if present) or `created_at`.
- Uses gateway-side metadata; Oxy does not rotate keys automatically.

Configuration (env)
- `KEY_ROTATION_MODE`: `off | warn | enforce` (default `warn`).
- `KEY_ROTATION_WARNING_DAYS`: start warning at this age (default `80`).
- `KEY_ROTATION_MAX_DAYS`: threshold for expired state (default `90`).
- Enforcement is opt-in; default behavior is warn-only with headers.

Behavior
- Fresh (< warning): pass through, no headers.
- Warning (>= warning, < max): allow; adds headers:
  - `X-Oxy-Key-Rotation-Status: warning`
  - `X-Oxy-Key-Age-Days`
  - `X-Oxy-Key-Expires-In-Days`
  - `X-Oxy-Key-Rotation-URL: <SITE_URL>/dashboard/api-keys` (`SITE_URL` defaults to `http://localhost:3000`)
- Expired (>= max):
  - `mode=warn`: allow but mark `X-Oxy-Key-Rotation-Status: expired`.
  - `mode=enforce`: block with 403 and error code `key_rotation_required`, plus the same headers.
- Fail-open on lookup errors (best-effort hygiene, not a compliance engine).

Example org/deployment policy (env)
```
KEY_ROTATION_MODE=warn
KEY_ROTATION_WARNING_DAYS=80
KEY_ROTATION_MAX_DAYS=90
```

Example response (warning)
```
HTTP/1.1 200 OK
X-Oxy-Key-Rotation-Status: warning
X-Oxy-Key-Age-Days: 85
X-Oxy-Key-Expires-In-Days: 5
X-Oxy-Key-Rotation-URL: http://localhost:3000/dashboard/api-keys
```

Limitations
- Best-effort visibility/nudges; not a sanctions/compliance engine.
- Does not rotate secrets for you; admins must rotate keys and update clients.
- Age relies on available timestamps; missing/invalid data is allowed (fail-open).
