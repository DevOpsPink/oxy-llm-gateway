# Default plan limits

Every organization has a plan tier: `free`, `starter`, `growth`, `business` or `enterprise`. A tier is a set of quotas (monthly requests, projects, agents, team members). The operator assigns it in the database; nothing in the gateway sells or changes it on its own.

New organizations start on `free`, which the gateway caps at 100K requests per calendar month (UTC).

## Where the tier lives

- `organizations.subscription_plan` (default `free`) is what the gateway reads on each request, in `routes/proxy.py`, `routes/agents.py`, `routes/billing_overview.py` and `routes/setup_v1.py`.
- To move an organization to another tier, update that column:

  ```sql
  UPDATE organizations SET subscription_plan = 'growth' WHERE id = '<org id>';
  ```

- When the optional Stripe module is enabled, `subscriptions.plan_tier` records the tier of a Stripe subscription; see `routes/billing.py`.

## Quotas per tier

The quota values live in `PLAN_LIMITS` in `packages/engine/routes/billing.py`, with the project caps in `main.py` and the request caps repeated in `fn_get_subscription_status` in `db/schema.sql`. Change them in all three places to tune a deployment. `enterprise` has no request cap.

## Free-tier enforcement

- **Counting:** requests per organization for the current calendar month, from `request_logs`. Pre-flight refusals (DLP blocks, malformed requests, expired keys) generally do not count.
- **Refusal:** past the cap the gateway answers `403` with error code `free_plan_limit_reached`. `packages/engine/tests/test_free_plan_limits.py` pins the behaviour.
- **Reset:** at the start of each UTC calendar month.
- **Scope:** the organization as a whole, not a project or an API key.
- A paused or suspended organization is refused before the cap is checked.

## Scope and caveats

- These are defaults for a self-hosted deployment, not a contract; tune them to your hardware and provider budgets.
- Spend budgets (`core/budget.py`) are separate from request quotas: an organization can hit either one first.
- There is no SLA at any tier; this is a reference implementation.
