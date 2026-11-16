# Screenshots

This directory holds the screenshots referenced from the project README and landing page. Captures are intentionally manual — the project does not ship an automated visual-regression suite.

## What to capture

Eight images, all 1440×900 (Retina) or 2880×1800 for high-DPI. Drop them in this directory with the filenames below; the README in the repo root already references these names.

| File | What it shows | Where to capture |
|---|---|---|
| `landing-hero.png` | Top of the public landing — hero, quickstart code block, GitHub CTA | `http://localhost:3000/` |
| `landing-features.png` | Six-card feature grid further down on the landing | scroll on `/` |
| `landing-architecture.png` | Architecture mini-diagram + tech stack section | scroll further on `/` |
| `dashboard-overview.png` | Dashboard home for a signed-in user with some seeded usage data | `http://localhost:3000/dashboard` |
| `dashboard-api-keys.png` | API keys management page with at least one key present | `http://localhost:3000/dashboard/api-keys` |
| `dashboard-budgets.png` | Billing/usage page showing the plan and this month's request count | `http://localhost:3000/dashboard/billing` |
| `dashboard-agents.png` | Agents list (even empty state is fine) | `http://localhost:3000/dashboard/agents` |
| `dashboard-playground.png` | Playground sending a `/v1/chat/completions` request and showing the streamed response | `http://localhost:3000/dashboard/playground` |

## Suggested capture flow

1. `docker compose up -d`
2. Sign in at `http://localhost:3000/login` with any email and open the magic link in Mailpit (`http://localhost:8025`)
3. Onboarding: add a provider key (or skip if testing empty-state)
4. Capture screens from the table above
5. Optionally seed a handful of fake `request_logs` rows so the dashboard isn't entirely empty. Put your
   organization and project ids (from the `organizations` and `projects` tables) in ORG and PROJECT:
   ```bash
   docker compose exec postgres psql -U postgres -d oxy -v org="$ORG" -v project="$PROJECT" -c \
     "INSERT INTO request_logs (organization_id, project_id, model, provider, status, prompt_tokens, completion_tokens, cost_usd, latency_ms)
      SELECT :'org',
             :'project',
             (ARRAY['gpt-4.1-mini','claude-3-haiku','gemini-1.5-flash'])[1 + (random()*2)::int],
             (ARRAY['openai','anthropic','google'])[1 + (random()*2)::int],
             'completed', (random()*1000)::int, (random()*500)::int,
             (random()*0.02)::numeric, (random()*1500)::int
      FROM generate_series(1, 200);"
   ```

## OG image

The landing page references `/og.png` for OpenGraph/Twitter cards. Put a 1200×630 PNG at `packages/ui/public/og.png`. A simple violet-on-dark "Oxy — Self-hosted LLM Gateway" with the GitHub URL works fine; a screenshot of the architecture diagram is a reasonable alternative.

## Notes

- Use a window without bookmark bars, dev tools, or browser warnings visible.
- Light theme matches the current UI palette; dark mode is not implemented.
- Compress with `pngquant` or `oxipng` before committing — these images get embedded in the README, so smaller is better.
