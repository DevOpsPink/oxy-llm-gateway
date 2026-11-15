# Slack / Discord Alerts (Outbound Webhooks)

Oxy can send budget and cost-anomaly alerts to your Slack or Discord channels using webhook URLs you supply. This is outbound-only and best-effort; delivery is not guaranteed.

## What this integration does
- Sends alerts for budget thresholds and cost anomalies to Slack/Discord via incoming webhooks you provide.
- Matches the same trigger set as email/webhooks (budget thresholds, anomaly detections).
- Keeps payloads concise (no raw prompts or secrets).

## What it does NOT do
- No inbound commands or bots; we do not read data from Slack/Discord.
- No SLA or guaranteed delivery; treat email/webhooks as primary.
- No storage of webhook URLs in logs or analytics; URLs are treated as secrets.

## Setup
1) Create a Slack Incoming Webhook
   - In Slack, create or reuse an Incoming Webhook and copy the URL (must start with `https://hooks.slack.com/`).
2) Create a Discord channel webhook
   - In Discord channel settings → Integrations → Webhooks → New Webhook, copy the URL (must start with `https://discord.com/api/webhooks/`).
3) In Oxy Dashboard → Notifications:
   - Toggle “Send alerts to Slack” and paste the Slack webhook URL.
   - Toggle “Send alerts to Discord” and paste the Discord webhook URL.
   - Save. Invalid URLs are rejected.

## Delivery semantics
- Best-effort with a short retry for transient errors; 4xx errors are not retried.
- Failures never block core billing/intelligence flows.
- If webhooks are disabled or missing, alerts fall back to email/webhooks only.

## Security & privacy
- Webhook URLs are validated and redacted in audit logs.
- Payloads include alert metadata (project, thresholds, spend, severity); no raw prompts/PII are sent.
- One-way outbound only.
