# Contributing to Oxy

Thanks for the interest. Oxy is maintained as a reference implementation; PRs and issues are welcome.

## Quick orientation

- [README.md](README.md) — what the project is, architecture diagram, quickstart
- [docs/getting-started/quickstart.md](docs/getting-started/quickstart.md) — full local setup walkthrough
- [DEV_NOTES.md](DEV_NOTES.md) — daily-work checklist for contributors
- [DEPLOY.md](DEPLOY.md) — deployment patterns
- [SECURITY.md](SECURITY.md) — cryptography, RLS, atomic ops, incident response
- [docs/product/FEATURE_MATRIX.yml](docs/product/FEATURE_MATRIX.yml) — canonical feature → code → tests → docs map

## Development workflow

```bash
git clone https://github.com/heyvaldemar/oxy-llm-gateway.git
cd oxy
docker compose up
```

The full stack runs end-to-end against bundled Postgres + PostgREST + GoTrue + nginx + Redis — no cloud accounts required.

For host-side Python work:

```bash
python3 -m venv .venv
.venv/bin/pip install -r packages/engine/requirements.txt
```

For host-side UI work:

```bash
cd packages/ui
pnpm install
pnpm dev
```

## Running tests

```bash
make test-core          # 258 offline pytest cases, sub-second on M-series Macs
make test-integration   # requires a running engine + live external services
```

UI:

```bash
cd packages/ui
pnpm test               # vitest unit tests
pnpm test:e2e           # playwright end-to-end
pnpm lint               # eslint, max-warnings=0
```

Before submitting a PR, run `make test-core` and `pnpm lint` at minimum.

## Commit hygiene

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) prefixes (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`). Look at recent history for the style:

```bash
git log --oneline
```

Commit messages explain the *why* and reference the affected surface (route, component, doc). Multi-paragraph bodies are welcome — atomic commits with rich messages are easier to review and revert than terse ones.

If your work touches the feature surface, update both `docs/product/FEATURE_MATRIX.yml` and the relevant doc page in `docs/`. The pre-merge check is:

```bash
python3 scripts/validate_feature_matrix.py
python3 scripts/lint_sla_language.py
```

(or `make lint-features` runs both).

## What we'll likely accept

- Bug fixes with a clear reproduction (link to the affected endpoint/route + the failing output)
- New tests covering existing behaviour
- Documentation corrections and clarifications
- Performance improvements that don't change the public contract
- Honest scope-narrowing — replacing a vague claim in code or docs with a tighter, accurate one

## What we'll probably push back on

- SLA-flavoured language ("99.9% uptime", "guaranteed savings", "SOC 2 certified"). Oxy is an Apache 2.0 reference implementation, not a contracted service. See `scripts/lint_sla_language.py`.
- Marketing prose in source comments: slogans, hype labels, financial projections or claims about users. Comments say what the code does and why.
- New top-level features without supporting tests and a corresponding entry in `FEATURE_MATRIX.yml`.
- Vendor lock-in. The self-hosted Postgres + PostgREST + GoTrue path is the default; PRs that re-introduce a hard dependency on hosted Supabase need a fallback for the local stack.

## Reporting security issues

Use GitHub Security Advisories: <https://github.com/heyvaldemar/oxy-llm-gateway/security/advisories/new>.

For general bug reports, open a regular issue. Threat-modelling and incident-response context lives in [SECURITY.md](SECURITY.md).

## License

By contributing you agree your contributions are licensed under the [Apache License 2.0](LICENSE).
