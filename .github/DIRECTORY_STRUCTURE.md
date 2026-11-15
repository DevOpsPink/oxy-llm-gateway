# 📂 Oxy Engine Directory Structure

**Quick Reference for Contributors**

---

## 🏗️ Repository Layout

```
oxy/
├── 📚 docs/                    # Active Documentation
│   ├── API.md                  # REST API reference
│   ├── BACKUPS.md              # Backup automation guide
│   ├── CHANGELOG.md            # Version history
│   ├── MAINTENANCE.md          # Weekly patching guide
│   ├── STRIPE.md               # Billing integration
│   └── archive/                # Historical reports & summaries
│
├── 🗄️ db/                      # Database Schemas
│   └── billing_schema.sql      # Stripe billing tables
│
├── 📦 packages/                # Source Code (Monorepo)
│   ├── engine/                 # Python FastAPI backend
│   │   ├── main.py             # API gateway entry point
│   │   ├── billing.py          # Stripe integration
│   │   ├── budget_worker.py    # Background budget sync
│   │   ├── log_worker.py       # Log persistence worker
│   │   ├── security_utils.py   # Encryption utilities
│   │   ├── redis_scripts.py    # Lua atomic operations
│   │   ├── providers/          # LLM provider adapters
│   │   │   ├── base.py         # Abstract provider interface
│   │   │   ├── openai_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   └── pricing.py      # Centralized pricing engine
│   │   └── tests/              # Pytest suite
│   │
│   └── ui/                     # Next.js 16 frontend
│       ├── src/app/            # Pages (App Router)
│       ├── src/components/     # React components
│       └── src/lib/            # Utilities
│
├── 🛠️ scripts/                 # Automation Scripts
│   ├── setup-supabase.sh       # Database initialization
│   └── weekly-maintenance.sh   # Dependency updates
│
├── 📊 grafana/                 # Monitoring Dashboards
│   └── provisioning/
│       ├── dashboards/
│       └── datasources/
│
├── 🔧 .github/                 # GitHub Configuration
│   ├── workflows/              # CI/CD pipelines
│   └── ISSUE_TEMPLATE/         # Bug/feature templates
│
└── 📄 Root Files               # Essential configs only
    ├── README.md               # Main project overview
    ├── DEPLOY.md               # Complete deployment guide
    ├── SECURITY.md             # Security policy
    ├── docker-compose.yml      # Development containers
    ├── docker-compose.prod.yml # Production containers
    ├── Dockerfile.engine       # Backend build
    ├── Dockerfile.ui           # Frontend build
    ├── package.json            # Monorepo config
    ├── pnpm-workspace.yaml     # Workspace definition
    └── prometheus.yml          # Metrics config
```

---

## 🎯 Where to Find Things

### I want to...

**Start the project locally:**
→ Read `DEPLOY.md` (Part 1: Local Development)

**Deploy to production:**
→ Read `DEPLOY.md` (Part 2: Production)

**Understand the API:**
→ Read `docs/API.md`

**Set up billing:**
→ Read `docs/STRIPE.md`

**Update dependencies:**
→ Read `docs/MAINTENANCE.md`

**Configure backups:**
→ Read `docs/BACKUPS.md`

**See what changed:**
→ Read `docs/CHANGELOG.md`

**Understand security:**
→ Read `SECURITY.md` (root)

**View historical reports:**
→ Browse `docs/archive/`

**Modify database schema:**
→ Edit `db/billing_schema.sql` or `scripts/setup-supabase.sh`

**Add a new LLM provider:**
→ Create `packages/engine/providers/YOUR_PROVIDER.py`

**Fix a bug in the API:**
→ Edit `packages/engine/main.py`

**Improve the UI:**
→ Edit files in `packages/ui/src/`

**Run tests:**
→ `cd packages/engine && pytest tests/`

---

## 📝 Contributing Guidelines

### Where to Add New Files

| File Type | Location | Example |
|-----------|----------|---------|
| **New API endpoint** | `packages/engine/main.py` | Add route handler |
| **New UI component** | `packages/ui/src/components/` | `button.tsx` |
| **New page** | `packages/ui/src/app/` | `dashboard/page.tsx` |
| **New test** | `packages/engine/tests/` | `test_new_feature.py` |
| **New LLM provider** | `packages/engine/providers/` | `google_provider.py` |
| **New SQL migration** | `db/` or `scripts/` | `migration_v4.sql` |
| **New documentation** | `docs/` | `FEATURE_NAME.md` |
| **Internal report** | `docs/archive/` | `AUDIT_2025_11_17.md` |
| **CI/CD workflow** | `.github/workflows/` | `deploy.yml` |
| **Monitoring dashboard** | `grafana/provisioning/dashboards/` | `custom.json` |

### Where NOT to Add Files

❌ **DO NOT** add loose `.md` files to the root  
❌ **DO NOT** add SQL files to the root  
❌ **DO NOT** add test files outside `tests/` directories  
❌ **DO NOT** add personal notes or temporary files  

---

## 🚫 What to Avoid

1. **Loose markdown files in root** → Use `docs/` or `docs/archive/`
2. **Hardcoded secrets** → Use environment variables
3. **SQL in Python** → Use `db/` for schemas
4. **Unstructured logs** → Use structured logging (structlog)
5. **Duplicate documentation** → Keep one source of truth

---

## 🔍 Quick Commands

```bash
# View clean root structure
ls -1 *.md *.yml *.yaml Dockerfile* Caddyfile

# List active documentation
ls -1 docs/*.md

# Count archived reports
ls -1 docs/archive/*.md | wc -l

# Find all Python files
find packages/engine -name "*.py" -not -path "*/venv/*"

# Find all React components
find packages/ui/src/components -name "*.tsx"

# Search for TODOs
grep -r "TODO" packages/ --exclude-dir=node_modules --exclude-dir=venv
```

---

## 📏 Standards

- **Root directory:** Essential configs only (README, DEPLOY, SECURITY)
- **Documentation:** Active in `docs/`, historical in `docs/archive/`
- **Code:** Organized by package (`engine/` = backend, `ui/` = frontend)
- **Tests:** Co-located with code (`packages/engine/tests/`)
- **Scripts:** Automation tools in `scripts/`
- **CI/CD:** GitHub Actions in `.github/workflows/`

---

**This structure is designed for:**
- ✅ Easy navigation
- ✅ Professional appearance
- ✅ Scalable growth
- ✅ Enterprise audits

---

*Questions? See `README.md` or ask in team chat.*

