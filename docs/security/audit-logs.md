# Audit & Request Logs (configurable retention, privacy-aware)

What is stored
- `request_logs`: org-scoped request metadata (ids, timestamps, model/provider, token counts, cost, latency, cache hit, threat flags, cost tags). Content snapshots depend on privacy mode:
  - `zero_prompt_logging`: no prompt/response text; snapshots are null.
  - `metadata_only` (default): metadata only; snapshots null.
  - `debug_full`: prompt/response snapshots stored only if `OXY_DEBUG_FULL_LOGS=true`.
- `admin_audit_logs` / `audit_log`: admin and system actions (e.g., settings changes), with resource ids, action, success flag, and minimal metadata.

Retention
- Per-org `request_log_retention_days` (min 7, default 365, max 2555). Worker clamps values and deletes rows older than the window.
- Long-term retention add-on can extend the configured window but is still policy-driven; no fixed SLA implied; best-effort only.

Privacy modes
- `zero_prompt_logging`: no raw text persisted; token counts/metadata only.
- `metadata_only`: default; still drops prompt/response snapshots.
- `debug_full`: allows snapshots only when explicitly enabled via env; otherwise text is dropped.

Exports
- `GET /v1/exports/requests.csv` returns CSV of `request_logs` with metadata fields; snapshots follow privacy mode (null when disallowed).

Example log record (metadata_only)
```
{
  "id": "log_123",
  "organization_id": "org_1",
  "project_id": "proj_1",
  "api_key_id": "key_1",
  "model": "gpt-4.1-mini",
  "provider": "openai",
  "status": "200",
  "latency_ms": 120,
  "prompt_tokens": 12,
  "completion_tokens": 6,
  "cost_usd": 0.0025,
  "privacy_mode": "metadata_only",
  "prompt_snapshot": null,
  "response_snapshot": null,
  "created_at": "2025-01-01T00:00:00Z"
}
```

Example CSV export snippet
```
id,created_at,provider,model,status,latency_ms,prompt_tokens,completion_tokens,total_tokens,cost_usd,project_id,privacy_mode
log_123,2025-01-01T00:00:00Z,openai,gpt-4.1-mini,200,120,12,6,18,0.0025,proj_1,metadata_only
```

Limitations and cautions
- Best-effort technical/audit logging; not a compliance guarantee (SOC2/HIPAA/etc.).
- Retention is policy/configuration driven; “long-term” depends on your configured window/add-on.
- Snapshots obey privacy mode and debug flag; secret data should not be sent if it must never be stored.
