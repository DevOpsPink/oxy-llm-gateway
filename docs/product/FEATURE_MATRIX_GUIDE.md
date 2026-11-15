# FEATURE_MATRIX guide

This guide explains how to add or modify a feature using the canonical matrix at `docs/product/FEATURE_MATRIX.yml`.

## Canonical source
- The only source of truth for features is `docs/product/FEATURE_MATRIX.yml`.
- GA counts in `DEV_NOTES.md` are derived from this file.
- CI enforces it via `make validate-features` and `make lint-features`.

## GA criteria (plain language)
A feature can be `status: ga` only if:
- **Implementation:** Every `code_refs` path exists and implements the `product_contract` summary/behavior.
- **Tests:** Automated tests exist for the happy path **and** at least one edge/error case matching the contract.
- **Docs:** User-facing docs exist and explain what it does, how to configure it (env/UI/API), and limitations/caveats.
- **Wording:** Landing and UI wording matches reality and, where applicable, uses conservative language: “heuristic”, “best-effort”, “subject to configuration”, “not a billing source of truth”, “not a monitoring/SOC SLA”.

If any of the above is missing and the fix is non-trivial, keep/downgrade to `status: beta` and add `gap_analysis`.

## Workflow to add or change a feature
1) **Update the matrix**: add/update the entry in `docs/product/FEATURE_MATRIX.yml` (id, product_contract, code_refs, tests, docs, status, gap_analysis).
2) **Implementation**: ensure the referenced `code_refs` exist and implement the contract.
3) **Tests**: add/verify tests for the behaviors in `product_contract` (happy path + edge/error case).
4) **Docs**: add/verify docs; include configuration steps and limitations (non-SLA/heuristic disclaimers where relevant).
5) **Run local checks**:
   - `make validate-features` (matrix refs exist)
   - `make lint-features` (matrix + SLA wording lint)
   - `pytest` (and relevant UI tests) if you touched code/UI
6) **UI copy**: if the landing or the UI references the feature, ensure copy matches the contract and includes “heuristic/best-effort/no SLA” framing when appropriate.

## Tips
- Use selectors (`file.py::test_name`) in `tests` entries if you need to point to specific cases.
- Use `gap_analysis` to track missing pieces (tests/docs/implementation) instead of over-claiming GA.
- Heuristic/analytics/cost/security features should always state that signals/forecasts are advisory, data-quality dependent, and not billing or monitoring SLAs.

