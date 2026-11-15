# Rate Limiting, Security Headers, and IP Protections

Network-facing controls to reduce abuse. Pair with a WAF for production.

- Rate limiting: enforced per key/endpoint via middleware (`packages/engine/middleware/rate_limit.py`).
- Security headers: HSTS/CSP/XSS headers applied when configured (`packages/engine/middleware/security.py`).
- IP/geo blocking: optional middleware (`packages/engine/middleware/geo_blocking.py`); effectiveness depends on deployment and IP/header data quality. See `docs/security/geo-blocking.md` for configuration and behavior.
- Scope: best-effort protections; not a full DDoS/WAF solution.
- Configuration: set limits and header policies in deployment configuration; verify in staging before production. For key rotation controls, see `docs/security/key-rotation.md`. For audit/request logs retention and privacy modes, see `docs/security/audit-logs.md`.
