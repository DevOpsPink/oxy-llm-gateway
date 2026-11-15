import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Github, ArrowLeft, Check, Minus } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Plan limits — Oxy',
  description:
    'Default plan limits enforced by the Oxy gateway. Plan tiers are quota levels an operator assigns in the database: request caps, project quotas, and team-member counts per tier.',
}

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'
const BILLING_SRC = `${REPO_URL}/blob/main/packages/engine/routes/billing.py`
const SCHEMA_SRC = `${REPO_URL}/blob/main/db/schema.sql`

// The route stays /pricing so existing links keep working; the page lists
// plan limits only. Keep in sync with PLAN_LIMITS in
// packages/engine/routes/billing.py and fn_check_plan_limit in db/schema.sql.
const plans = [
  {
    id: 'free',
    name: 'Free',
    default: true,
    projects: '1',
    agents: '3',
    members: '1 (solo)',
  },
  {
    id: 'starter',
    name: 'Starter',
    projects: '5',
    agents: '10',
    members: '3',
  },
  {
    id: 'growth',
    name: 'Growth',
    projects: '20',
    agents: '50',
    members: '10',
  },
  {
    id: 'business',
    name: 'Business',
    projects: 'unlimited',
    agents: 'unlimited',
    members: '50',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    projects: 'unlimited',
    agents: 'unlimited',
    members: 'unlimited',
  },
] as const

export default function PlanLimitsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Link>
          <Link
            href={REPO_URL}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <Github className="h-4 w-4" />
            GitHub
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
            Reference — not a contract
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">Plan limits</h1>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Oxy ships with a built-in plan system: each organisation has a <code className="text-sm bg-slate-100 px-1.5 py-0.5 rounded">plan_tier</code>{' '}
            column, and the gateway enforces per-month request caps plus a handful of other quotas
            based on that column. Tiers are quota levels the operator assigns in the database.
            These are the defaults; tune them in code for your own deployment.
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            These are the policy values the gateway applies — set an org&apos;s tier directly in the
            database to change its caps. If you enable the optional Stripe module, each tier maps to
            a Stripe Price ID you configure via <code className="text-sm bg-slate-100 px-1.5 py-0.5 rounded">STRIPE_PRICE_ID_*</code>{' '}
            env vars (see{' '}
            <Link href={`${REPO_URL}/blob/main/DEPLOY.md`} className="text-violet-600 hover:underline">
              DEPLOY.md
            </Link>
            ).
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Plan</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Projects</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Agents</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Team</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    {'default' in p && p.default && (
                      <span className="text-xs text-violet-600 mt-0.5 inline-flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Default for new orgs
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-700">{p.projects}</td>
                  <td className="py-4 px-4 text-slate-700">{p.agents}</td>
                  <td className="py-4 px-4 text-slate-700">{p.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">No request quota</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              No tier caps how many requests an organization sends. Spend is capped by each
              project&apos;s budget, checked before a request reaches a provider. Requests are still
              counted per organization and UTC calendar month for the dashboard.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">Changing a plan</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Self-hosted: update the{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">plan_tier</code>{' '}
              column on the org row in Postgres. No Stripe required. To change the caps themselves,
              edit{' '}
              <Link href={BILLING_SRC} className="text-violet-600 hover:underline">
                PLAN_LIMITS
              </Link>{' '}
              in <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">routes/billing.py</code>
              {' '}and rebuild.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">No SLAs</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Uptime, latency, retention, and savings are <strong>not</strong> guaranteed at any tier.
              Oxy is an Apache 2.0 reference implementation; a tier changes quotas only, not
              support or response times.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">What&apos;s the &quot;free plan&quot; then?</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              It's just the default <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">plan_tier</code>{' '}
              assigned to new orgs by the seed in{' '}
              <Link href={SCHEMA_SRC} className="text-violet-600 hover:underline">
                db/schema.sql
              </Link>
              . Operators can leave every org on{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">free</code>{' '}
              and just raise the cap globally.
            </p>
          </div>
        </div>

        <div className="mt-12 max-w-4xl rounded-xl border border-violet-200 bg-violet-50/50 p-6">
          <h3 className="font-semibold text-slate-900">Running this in production?</h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Read{' '}
            <Link href={`${REPO_URL}/blob/main/DEPLOY.md`} className="text-violet-600 hover:underline">
              DEPLOY.md
            </Link>{' '}
            for the two deployment patterns (self-hosted Postgres vs hosted Supabase), TLS via
            Caddy, secrets rotation, monitoring, and the optional Stripe wiring if you are billing
            customers.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={REPO_URL}>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white">
                <Github className="h-4 w-4 mr-2" />
                Source on GitHub
              </Button>
            </Link>
            <Link href={`${REPO_URL}/blob/main/docs/product/FEATURE_MATRIX.yml`}>
              <Button variant="outline">Feature matrix</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
