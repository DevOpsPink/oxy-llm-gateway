# Cost Optimizer (Heuristic)

- API: `GET /v1/cost-optimizer/recommendations?window=7d|30d&limit<=50`
- UI: `/dashboard/optimizer`
- Recommendations are heuristic and estimates only — not guaranteed savings or billing truth.
- Advisory only: does not auto-apply changes; you choose whether to act.
- Accuracy depends on request_logs quality and pricing metadata; low traffic can yield noisy suggestions.

## How recommendations are generated
- Source data: `request_logs` aggregated by model/provider over the selected window.
- Model switch: suggest cheaper alternates (e.g., gpt-4.1 -> gpt-4.1-mini) when high-cost models dominate.
- Caching: suggest enabling response caching when request volume is high/repetitive.
- Throttling: suggest rate-limiting bursty, low-value traffic.
- Each recommendation includes `estimated_monthly_savings_usd` (best-effort) and supporting stats.

## How to verify quickly
- Ensure `request_logs` has at least a few entries (model/provider/cost).
- Call `GET /v1/cost-optimizer/recommendations?window=7d&limit=10` with an authenticated API key.
- Expect a JSON body with `recommendations[]`; when data is minimal, list may be empty but still well-formed.
- Verify `estimates_only` (or similar flag) is present to indicate advisory/heuristic output.

## Limitations
- Heuristic only; no guaranteed savings or billing accuracy.
- Depends on data quality and correct model pricing metadata.
- Estimates can be noisy with low volume or atypical traffic mixes.
- Does not modify your infrastructure/config automatically unless you wire it up.

For broader non-goals and best-effort caveats, see `docs/product/known-gaps-and-non-goals.md`.

## Output fields
- `window`, `data_window_start`, `currency`, `estimates_only` flag.
- `recommendations[]`: type (`model_switch`, `enable_caching`, `rate_limit`), title, description, estimated savings, confidence, supporting stats.

## Prerequisites
- Cost pipeline populated (`request_logs`).
- Pricing metadata available for models when using model-switch suggestions.
- Caching and rate-limit controls configured for the org if you want to apply recommendations.
