# Geo-blocking (best-effort, IP/header based)

What it does
- Blocks requests from configured countries/regions using request headers first (`CF-IPCountry`, `X-Country-Code`, `X-Geo-Country`), with optional IP lookup as a fallback when explicitly enabled.
- Returns a structured error with `error.code = "geo_blocked"` and status `451` (default) when blocked.
- Logs country/source only (no full IP); unknown countries are allowed by default with an informational log.

How country is determined
- Prefer Cloudflare or proxy headers:
  - `CF-IPCountry` (primary)
  - `X-Country-Code`, `X-Geo-Country`, `X-Appengine-Country` (fallback headers)
- Optional IP lookup (disabled by default to keep tests/offline deployments stable). When enabled, uses a best-effort IP→country lookup; accuracy depends on the provider and may be bypassed (VPNs/proxies).
- Source is recorded (`cf_ipcountry`, `x_country_code`, `ip_lookup`, etc.) for auditing.

Configuration (deployment-level)
- `ENABLE_GEO_BLOCKING` (bool): enable the middleware (disabled by default in code registration).
- `GEO_BLOCKED_COUNTRIES` (CSV list): ISO country codes to block. Default baseline set: `KP,IR,SY,CU`. This is configuration, not legal advice—operators must maintain the list for their compliance posture.
- `GEO_BLOCKED_REGIONS` (CSV list, optional): region/state codes if provided by upstream headers (e.g., `X-Region-Code`).
- `GEO_FAIL_OPEN_ON_UNKNOWN` (bool): when no country is resolved, allow + log (default). Set to `false` to block unknown with `geo_blocked`.
- `GEO_ENABLE_IP_LOOKUP` (bool): enable IP geolocation lookup when headers are absent (off by default).
- `GEO_BLOCK_STATUS_CODE` (int): HTTP status when blocked (default `451`; `403` also supported).

Behavior
- Blocked country/region → `451` (default) with body:
  ```
  {
    "error": {
      "code": "geo_blocked",
      "message": "Requests from this region are not allowed.",
      "country": "IR",
      "source": "cf_ipcountry",
      "reason": "country_blocked"
    }
  }
  ```
- Unknown country → allow + log by default; configurable to block with `GEO_FAIL_OPEN_ON_UNKNOWN=false`.
- Health/metrics paths are skipped (`/health`, `/metrics`).

Limitations and cautions
- Best-effort, IP/header-based signal; VPNs/proxies/Tor can bypass or obfuscate country.
- Not a sanctions or export-compliance engine—operators must maintain policy lists.
- Accuracy depends on upstream headers or the configured IP lookup provider.
- Do not log full IPs; middleware logs country + source only to reduce PII exposure.
