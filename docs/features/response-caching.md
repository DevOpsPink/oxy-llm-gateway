# Response Caching

Deterministic responses can be cached to reduce repeat provider calls.

- Scope: non-streaming, deterministic requests routed through the gateway.
- Behavior: identical requests (model + messages + params) may return a cached response with `X-Oxy-Cache: hit`.
- Guarantees: best-effort; cache misses and bypasses can occur. No savings are guaranteed.
- Controls: caching logic lives in `packages/engine/core/response_cache.py` and is used by `/v1/chat/completions`.
- Troubleshooting: if caching is disabled or misses, check request determinism (temperature, tools) and provider errors.
