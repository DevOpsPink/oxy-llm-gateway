# Agent Templates

Agent templates let you start sessions from predefined, validated configurations without mixing runtime state.

## What this feature does
- Provides predefined agent types/roles in the dashboard and API.
- Applies backend validation for template allowlists, budgets, and guardrails before session creation.
- Keeps templates separate from live sessions; edits to a template do not mutate running sessions.

## How to use
- Pick a template in Dashboard → Agent Templates (or via `/v1/agents` where supported) and supply your project/keys.
- Customize allowed tools/models and budgets per template before launching sessions.
- Sessions created from templates inherit privacy/budget settings; you can still kill or pause sessions independently.

## Limits and cautions
- Templates are guardrail/config baselines, not hard sandboxes; verify downstream tools and code.
- Validation depends on your configured allowlists/budgets; misconfiguration can still allow overly broad access.
- No autoscaling or orchestration is provided; templates help with setup, not runtime scheduling.


