# Zapier Integration (Outbound Triggers)

Oxy can send selected events to Zapier so you can build automations without exposing prompts or secrets.

## What it does
- Sends outbound events (e.g., budget thresholds, cost anomalies, new org/project events when enabled) to a Zapier webhook you configure.
- Payloads are minimized: IDs, names, plan/usage metadata, event type, and timestamps. No prompt/response text or secrets.
- Best-effort delivery with a short retry on transient failures; failures never block Oxy’s core flows.

## What it does NOT do
- No inbound commands from Zapier; Oxy does not pull data from Zapier.
- No SLA or guaranteed delivery; Zapier execution is Zapier’s responsibility.
- No prompt text, secrets, or PII are sent.

## Setup
1) In Zapier, create a “Catch Hook” trigger and copy the webhook URL (must start with `https://hooks.zapier.com/`).
2) In Oxy Dashboard → Integrations → Zapier:
   - Enable Zapier.
   - Paste the webhook URL.
   - Choose which events to send (budget thresholds, anomalies).
   - Save.

## Example automations
- Cost spike detected → Zapier sends Slack/Email/Teams via your Zap.
- Budget threshold reached → Add a row in Google Sheets or open a ticket.
- New organization created (if enabled later) → Notify RevOps/CRM via Zapier.

## Delivery semantics
- Best-effort: one retry on 5xx/network errors; no retries on 4xx.
- Disabled or missing URL → no Zapier calls.
- Keep email/webhooks as primary channels.
