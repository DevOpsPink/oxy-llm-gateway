import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security — Oxy',
  description:
    'Security model of the Oxy reference implementation: cryptography, row-level security, atomic financial operations, audit logs, and incident response procedures. Apache License 2.0; no compliance certifications.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/security` },
}

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'

const summary = [
  {
    title: 'Cryptography',
    body: 'API keys stored as bcrypt hashes. Response cache payloads encrypted with AES-GCM (key from SUPABASE_SERVICE_KEY). Vault secrets use pgcrypto AES with a configurable key. JWTs HS256-signed with a deployment-wide secret.',
  },
  {
    title: 'Row-level security',
    body: 'Postgres RLS enforces org/project isolation on every table with user-scoped access. service_role bypasses RLS for engine workers; anon and authenticated roles read only what their JWT claims authorise.',
  },
  {
    title: 'Atomic budget operations',
    body: 'Budget reservations, credit redemptions, and cost recording all run as Lua scripts on Redis to avoid TOCTOU and double-spend races. See core/budget.py.',
  },
  {
    title: 'DLP and privacy modes',
    body: 'Pre-provider regex checks for cards, JWTs, key shapes, emails (best-effort). Three privacy modes: zero_prompt_logging, metadata_only (default), debug_full (gated by env flag).',
  },
  {
    title: 'Audit logs',
    body: 'Admin actions and guardrail changes log to admin_audit_logs. Request logs retained per org policy (7-2555 days). CSV export at /v1/exports/requests.csv.',
  },
  {
    title: 'Rate limiting, security headers, geo controls',
    body: 'Per-key and per-management rate limits via slowapi. Standard HSTS / CSP / X-Frame-Options on UI responses. Optional country/region blocking via configurable allow/denylist.',
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to overview
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-violet-600" />
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Security model</h1>
        </div>

        <p className="mt-5 text-slate-600 leading-relaxed max-w-3xl">
          This page summarises the security mechanisms built into Oxy. It is not a compliance
          attestation. For the canonical, code-anchored document — including incident response
          procedures and threat-modelling notes — read{' '}
          <Link href={`${REPO_URL}/blob/main/SECURITY.md`} className="text-violet-600 hover:underline">
            SECURITY.md
          </Link>{' '}
          in the repository.
        </p>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700 leading-relaxed flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Reference implementation, not a certified service.</strong>{' '}
            Oxy is Apache 2.0 software, not a hosted service. There are no SOC 2 / ISO 27001 / HIPAA / GDPR
            certifications attached to this codebase — those apply to specific operators who deploy
            and contract for them. The mechanisms below are the tools an operator would use.
          </div>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {summary.map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-3xl">
          <h2 className="text-xl font-semibold tracking-tight">Reporting vulnerabilities</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            If you find a security issue, open a private security advisory on GitHub at{' '}
            <Link href={`${REPO_URL}/security/advisories/new`} className="text-violet-600 hover:underline">
              {REPO_URL.replace('https://', '')}/security/advisories
            </Link>
            . For general questions or non-sensitive bug reports, open a regular issue. The
            maintainer reviews advisories on a best-effort basis; there is no formal SLA.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={`${REPO_URL}/blob/main/SECURITY.md`}>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white">
              Read SECURITY.md
              <ExternalLink className="h-3.5 w-3.5 ml-2" />
            </Button>
          </Link>
          <Link href={`${REPO_URL}/blob/main/docs/security/privacy-modes.md`}>
            <Button variant="outline">Privacy modes</Button>
          </Link>
          <Link href={`${REPO_URL}/blob/main/docs/security/audit-logs.md`}>
            <Button variant="outline">Audit logs</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
