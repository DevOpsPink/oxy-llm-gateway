# Production deployment

For local development see [`README.md`](README.md) and [`docs/getting-started/quickstart.md`](docs/getting-started/quickstart.md) — `docker compose up` and you're done.

This document covers running Oxy in production: two deployment patterns, TLS, secrets, billing wiring, and monitoring. Both patterns assume a single small VPS (2 vCPU / 4GB RAM is enough for low-volume workloads).

## Deployment patterns

| Pattern | When to use | Backing services |
|---|---|---|
| **A — Self-hosted full stack** | You want zero cloud dependencies and a single thing to manage | Postgres + PostgREST + GoTrue + nginx + Redis on your VPS |
| **B — Hosted Supabase backend** | You already have a Supabase project, prefer their managed Postgres, or want their dashboard | Hosted Supabase for Postgres + Auth + REST; Redis + the engine + UI on your VPS |

Pattern A is what `docker-compose.yml` configures by default. Pattern B drops the four Supabase-equivalent containers and points `SUPABASE_URL` at your hosted project.

## 1. Provision a VPS

Any modern Linux VPS works. Tested combinations:

| Provider | Spec | Cost (approx) |
|---|---|---|
| Hetzner CX22 | 2 vCPU / 4GB / 40GB | €4-5/mo |
| DigitalOcean Basic | 2 vCPU / 4GB / 80GB | $24/mo |
| Vultr Regular Cloud | 2 vCPU / 4GB / 80GB | $24/mo |

Pick Ubuntu 22.04 LTS or Debian 12. SSH key auth, not passwords.

## 2. Install Docker

```bash
ssh root@YOUR_SERVER_IP

apt update && apt upgrade -y
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker --version
docker compose version
```

## 3. Clone and configure

```bash
git clone https://github.com/heyvaldemar/oxy-llm-gateway.git /opt/oxy
cd /opt/oxy

cp packages/engine/ENV.example packages/engine/.env
nano packages/engine/.env
```

Edit `.env` with production values — see [the env vars reference](#environment-variables-reference) below. At minimum:

```env
ENVIRONMENT=production
SECRET_KEY=<generate with: openssl rand -hex 32>
REDIS_PASSWORD=<generate with: openssl rand -base64 32>
SUPABASE_JWT_SECRET=<generate with: openssl rand -hex 32>
SUPABASE_VAULT_KEY=<generate with: openssl rand -base64 32>
```

For Pattern B (hosted Supabase) also set:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key from Supabase dashboard>
```

For Pattern A (self-hosted full stack) leave `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` unset — the compose defaults point at the local nginx and use a dev service-role JWT. **For production you must rotate that JWT.** Generate a new service-role token signed with your new `SUPABASE_JWT_SECRET`:

```bash
python3 -c "import jwt, time; print(jwt.encode(
  {'role':'service_role','iss':'oxy','iat':int(time.time()),
   'exp':int(time.time())+60*60*24*365*10},
  '<your SUPABASE_JWT_SECRET>', algorithm='HS256'))"
```

Set the output as `SUPABASE_SERVICE_KEY`. Repeat with `'role':'anon'` to mint a new anon key and update the UI env.

## 4. Configure DNS

Pick a domain. For Cloudflare:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `YOUR_SERVER_IP` | Proxied |
| A | `api` | `YOUR_SERVER_IP` | Proxied |

Update nameservers at your registrar. Allow up to 30 minutes for propagation.

In Cloudflare → SSL/TLS:

- Mode: **Full (strict)**
- Edge certificates: enable **Always Use HTTPS**

## 5. Launch with `docker-compose.prod.yml`

The repository ships a production compose file with TLS via Caddy, hardened security options (`read-only` filesystems, `no-new-privileges`, resource limits), structured JSON logging, and Prometheus metrics.

```bash
cd /opt/oxy
git pull origin main

# Set your domain for Caddy's automatic Let's Encrypt
echo "DOMAIN=yourcompany.com" >> .env

docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
```

Caddy automatically obtains and renews Let's Encrypt certificates for `${DOMAIN}` and `api.${DOMAIN}`. Verify:

```bash
curl https://api.yourcompany.com/health
# → {"status":"healthy", ...}
```

## 6. Wire Stripe (optional)

The Stripe module is for operators who charge their own users for gateway access. To turn it on:

1. [Create webhook endpoint](https://dashboard.stripe.com/webhooks) pointing at `https://api.yourcompany.com/billing/webhook`
2. Subscribe to: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.{paid,payment_failed}`
3. Copy the signing secret (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`
4. Create one Stripe price per plan tier (`starter`, `growth`, `business`, `enterprise`), monthly and optionally yearly; the amounts are yours to set
5. Set the resulting `price_...` IDs in `.env` as `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_GROWTH`, etc.
6. Set `STRIPE_SECRET_KEY`

Without Stripe, skip this section: the Stripe endpoints answer 503, everything else works, and you assign plan tiers in the database (`organizations.subscription_plan`, see `docs/getting-started/free-tier.md`).

## 7. Monitoring

The compose file ships with Prometheus (`prometheus.yml`) and Grafana (`grafana/`). Once running, `/metrics` is exposed (basic-auth-protected — set `METRICS_USER` / `METRICS_PASSWORD`).

For external monitoring point at `https://api.yourcompany.com/health` — it returns `200` with Redis and Postgres reachability status, suitable as an uptime probe.

For error tracking set `SENTRY_DSN` in `.env`. The engine and UI both ship with Sentry integration.

## Environment variables reference

See `packages/engine/ENV.example` for the complete annotated list. The critical ones for production:

### Required

```env
ENVIRONMENT=production
SECRET_KEY=                # openssl rand -hex 32 — Django/FastAPI session signing
SUPABASE_URL=              # https://<project>.supabase.co or http://nginx-postgrest:8080
SUPABASE_SERVICE_KEY=      # service-role JWT
SUPABASE_JWT_SECRET=       # must match between engine, PostgREST, and GoTrue
REDIS_URL=                 # redis://:<password>@redis:6379/0
REDIS_PASSWORD=            # openssl rand -base64 32
```

### Required for self-hosted Postgres (Pattern A)

```env
POSTGRES_DB=oxy
POSTGRES_USER=postgres
POSTGRES_PASSWORD=         # openssl rand -base64 32
SUPABASE_VAULT_KEY=        # openssl rand -base64 32 — encrypts vault.secrets rows
```

### Optional: Stripe billing

```env
STRIPE_SECRET_KEY=         # sk_live_...
STRIPE_WEBHOOK_SECRET=     # whsec_...
STRIPE_PRICE_ID_STARTER=
STRIPE_PRICE_ID_GROWTH=
STRIPE_PRICE_ID_BUSINESS=
STRIPE_PRICE_ID_ENTERPRISE=
# plus *_YEARLY variants
```

### Required for budget alerts and team invites

```env
RESEND_API_KEY=            # re_... from resend.com
EMAIL_FROM=                # alerts@yourdomain — must be verified at Resend
EMAIL_ENABLED=true
```

### Recommended

```env
SENTRY_DSN=                # error tracking
METRICS_USER=admin
METRICS_PASSWORD=          # openssl rand -base64 48
ALLOWED_ORIGINS=https://yourcompany.com
ALLOWED_HOSTS=yourcompany.com,api.yourcompany.com
RATE_LIMIT_PER_MINUTE=60
```

For Pattern A (self-hosted full stack) in production also disable GoTrue's email auto-confirm and configure SMTP:

```env
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMTP_HOST=
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=
GOTRUE_SMTP_PASS=
GOTRUE_SMTP_SENDER_NAME=Oxy
GOTRUE_SMTP_ADMIN_EMAIL=
```

## Troubleshooting

**"Cannot connect to Docker daemon"** — `systemctl start docker`. If on a fresh VPS, log out and back in after adding your user to the docker group.

**"Database migration failed"** in the engine logs — for Pattern A this usually means a partial init left the volume in an inconsistent state. Wipe and retry: `docker compose -f docker-compose.prod.yml down -v && docker compose -f docker-compose.prod.yml up -d`. **This destroys data.**

**Caddy can't get certificates** — check that ports 80/443 are open on the VPS firewall (`ufw allow 80,443/tcp`), that DNS A records point at the right IP, and that Cloudflare is in Full (strict) mode. Caddy logs (`docker compose -f docker-compose.prod.yml logs caddy`) show ACME details.

**`502 Bad Gateway`** — the engine container is unhealthy. Check `docker compose -f docker-compose.prod.yml ps` and the engine logs. Most common cause is a missing or wrong `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`.

**GoTrue migrations fail** on a Pattern A deploy — only an issue on a non-fresh `postgres_data` volume. Same fix as above (wipe and retry).

## Upgrade procedure

```bash
cd /opt/oxy
git pull origin main
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

Schema changes ship in `db/schema.sql`. For Pattern B (hosted Supabase) re-apply via the dashboard SQL editor or `psql -f db/schema.sql`. For Pattern A the schema only re-applies on a fresh volume; for in-place updates use a migration tool or apply incremental SQL manually.

## Backups

Pattern A:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres -d oxy -F c -f /var/lib/postgresql/data/backup-$(date +%F).dump

# Copy to offsite storage
scp root@YOUR_SERVER_IP:/var/lib/docker/volumes/oxy_postgres_data/_data/backup-*.dump ./
```

Schedule via cron. Restore with `pg_restore`.

Pattern B: use Supabase's built-in backups (Project Settings → Database → Backups).

## Related documentation

- [`SECURITY.md`](SECURITY.md) — cryptography, RLS, atomic budget operations, incident response procedures
- [`DEV_NOTES.md`](DEV_NOTES.md) — daily development workflows, test layout, contributing
- [`docs/security/privacy-modes.md`](docs/security/privacy-modes.md) — `zero_prompt_logging` / `metadata_only` / `debug_full`
- [`docs/product/FEATURE_MATRIX.yml`](docs/product/FEATURE_MATRIX.yml) — canonical feature → code → tests → docs map
