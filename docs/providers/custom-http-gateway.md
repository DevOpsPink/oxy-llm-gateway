# Custom HTTP (OpenAI-Compatible)

Connect any OpenAI-compatible HTTP endpoint as a local provider.

- Endpoint: set via `LOCAL_HTTP_BASE_URL` (or use provider config API).
- API: must support `/v1/chat/completions` with OpenAI-format requests.
- Models: use `model="local/<name>"` or your service’s model ID.
- Guardrails: DLP/privacy/budget checks run in the same path as cloud providers.
- Limitations:
  - You are responsible for hosting, scaling, and securing the endpoint.
  - Performance/latency/model quality depend on your service.
  - Ensure proper authentication if your endpoint requires it.
