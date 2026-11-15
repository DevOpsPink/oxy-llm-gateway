# Recipe: Hybrid Stack (Local vLLM + Cloud)

Combine a local vLLM endpoint with cloud providers behind Oxy.

- Example path: `examples/hybrid-stack/`
- Prereqs: Docker + Compose; set cloud provider keys in Oxy.
- Run: `docker-compose up -d` (vLLM on `http://localhost:8001` by default).
- Route to local by choosing the vLLM-served model name; route to cloud by choosing a cloud model ID.
- You can add simple routing in your client (e.g., fallback to cloud on errors or for larger tasks).

Related FEATURE_MATRIX:
- `providers/cloud` + local provider, `privacy-modes`, `kill-switch`, `budgets`.
