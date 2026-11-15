# Default plan limits

Every organization has a plan tier: `free`, `starter`, `growth`, `business` or `enterprise`. A tier sets caps on projects, agents and team members. The operator assigns it in the database; nothing in the gateway sells or changes it on its own.

No tier caps requests. What an organization can spend is capped by each project's budget, which the gateway reserves atomically before a request reaches a provider (`core/budget.py`). Requests are still counted per organization and UTC calendar month (`org_monthly_usage`) for the dashboard.

## Where the tier lives

- `organizations.subscription_plan` (default `free`) is what the gateway reads, in `routes/agents.py`, `routes/billing_overview.py`, `routes/setup_v1.py` and project creation in `main.py`.
- To move an organization to another tier, update that column:

  ```sql
  UPDATE organizations SET subscription_plan = 'growth' WHERE id = '<org id>';
  ```

- When the optional Stripe module is enabled, `subscriptions.plan_tier` records the tier of a Stripe subscription; see `routes/billing.py`.

## Caps per tier

The values live in `PLAN_LIMITS` in `packages/engine/routes/billing.py`, with the project caps in `main.py`. `enterprise` has none. `packages/engine/tests/test_request_quota.py` shows that a `free` organization far past any monthly count is still served.

## Scope and caveats

- These are defaults for a self-hosted deployment, not a contract; tune them to your hardware and provider budgets.
- There is no SLA at any tier; this is a reference implementation.
