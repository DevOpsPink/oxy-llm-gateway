# `packages/ui`

Next.js dashboard for the Oxy gateway. App Router with TypeScript strict mode, Tailwind, and Radix UI primitives.

> For project-level setup (docker compose, env vars, architecture) see the [top-level README](../../README.md) and [`docs/getting-started/quickstart.md`](../../docs/getting-started/quickstart.md).

## Stack

- **Next.js 16** (App Router, Turbopack dev server, Webpack production builds)
- **TypeScript** with `strict: true`
- **Tailwind CSS** + **Radix UI** primitives wrapped via `src/components/ui/` (shadcn-style)
- **supabase-js** + **@supabase/ssr** for auth (against either hosted Supabase or the bundled GoTrue)
- **Vitest** for unit tests, **Playwright** for E2E

## Routes

```
src/app/
├── page.tsx                      # Public landing
├── pricing/                      # Plan-limits docs page
├── (legal)/                      # /privacy, /terms, /security
├── login/                        # GoTrue sign-in / sign-up
├── onboarding/                   # First-run org / provider setup
├── dashboard/                    # Authenticated dashboard
│   ├── api-keys/
│   ├── agents/
│   ├── billing/
│   ├── playground/
│   ├── privacy/
│   ├── audit/
│   ├── notifications/
│   ├── providers/
│   ├── team/
│   ├── settings/
│   └── setup/                    # Setup wizard
├── tools/token-calculator/       # Public utility
└── docs/                         # Mirrored feature docs (subset of /docs at repo root)
```

## Development

From the repo root, the full stack including this UI is brought up by:

```bash
docker compose up ui
```

For UI-only iteration without the rest of the stack:

```bash
cd packages/ui
pnpm install
pnpm dev          # http://localhost:3000 with hot reload
```

You will need a backend running for any authenticated route to work. The simplest way is to leave the other compose services up (`docker compose up redis postgres postgrest gotrue nginx-postgrest engine`) and just run the UI on the host.

## Environment

The UI reads these at build and request time. See [`.env.local`](.env.local.example) (when present) or `docker-compose.yml` for the defaults.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-side base URL for auth + REST (defaults to `http://localhost:8080`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-side JWT (anon role) |
| `INTERNAL_SUPABASE_URL` | Server-side base URL used during SSR; in docker it is `http://nginx-postgrest:8080`, on the host it equals `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_API_URL` | Browser-side base URL for the gateway engine (`http://localhost:8000` in dev) |
| `INTERNAL_API_URL` | Server-side equivalent (`http://engine:8000` in docker) |
| `NEXT_PUBLIC_SITE_URL` | Used in metadata and sitemap (`http://localhost:3000` in dev, your deployment's public URL in prod) |

## Tests

```bash
pnpm test             # Vitest, includes component snapshots
pnpm test:e2e         # Playwright; requires the dev server running
pnpm lint             # ESLint with max-warnings=0
```

## License

Apache License 2.0 — see [`LICENSE`](../../LICENSE) at the repo root.
