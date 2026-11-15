import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy notes — Oxy',
  description:
    'Privacy notes for the Oxy reference implementation. What the gateway logs by default, how to switch privacy modes, and who is responsible for personal data in a self-hosted deployment.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/privacy` },
}

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to overview
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <Shield className="h-6 w-6 text-violet-600" />
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Privacy notes</h1>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 leading-relaxed">
          Oxy is an open-source reference implementation under Apache License 2.0. It is not a hosted
          service. When you run it, <strong>you</strong> are the data controller and processor for whatever flows
          through your deployment.
        </div>

        <section className="mt-10 prose prose-slate max-w-none">
          <h2>What the gateway logs by default</h2>
          <p>
            With the default <code>metadata_only</code> privacy mode, the gateway writes one row to
            <code> request_logs</code> per request containing: timestamp, model, provider, token counts, cost,
            latency, HTTP status, cache hit/miss, threat flags, and any cost-attribution tags you set.
            Prompt and response bodies are <strong>not</strong> stored.
          </p>

          <h2>Other privacy modes</h2>
          <p>The org-level <code>privacy_mode</code> column on <code>organizations</code> controls what gets stored:</p>
          <ul>
            <li>
              <code>zero_prompt_logging</code> — metadata only, no per-request rows at all. Use this
              when you cannot store any user content for compliance reasons.
            </li>
            <li>
              <code>metadata_only</code> (default) — request metadata as described above; no prompt
              or response text.
            </li>
            <li>
              <code>debug_full</code> — stores prompt and response text. Only when explicitly enabled
              via env flag <code>OXY_DEBUG_FULL_ENABLED</code>; intended for development.
            </li>
          </ul>
          <p>
            Switch modes via <code>POST /v1/privacy</code> or the{' '}
            <Link href="/dashboard/privacy">Privacy</Link> page in the dashboard. Full details in{' '}
            <Link href={`${REPO_URL}/blob/main/docs/security/privacy-modes.md`} className="underline">
              docs/security/privacy-modes.md
            </Link>
            .
          </p>

          <h2>Retention</h2>
          <p>
            Each org has a <code>request_log_retention_days</code> column (default 365, range 7-2555).
            A background worker deletes rows older than that window. Retention is policy-driven; nothing
            in the code enforces a contractual minimum.
          </p>

          <h2>DLP</h2>
          <p>
            Pre-provider regex checks detect card-like numbers, JWT shapes, common API key prefixes,
            and email addresses. Default mode is <code>log</code>; switch to <code>block</code> to
            refuse requests that match. The patterns are best-effort, not a guarantee of secret
            non-leakage.
          </p>

          <h2>If you deploy Oxy as a service</h2>
          <p>
            You are responsible for your own privacy notice, lawful basis, DSAR handling, and breach
            procedures. The mechanisms above (privacy modes, retention, DLP, audit logs) are tools you
            can use to support those obligations; they are not themselves a compliance certification.
          </p>

          <h2>Source of truth</h2>
          <p>
            For the canonical security model — cryptography, RLS policies, atomic financial ops,
            incident response — read{' '}
            <Link href={`${REPO_URL}/blob/main/SECURITY.md`} className="underline">SECURITY.md</Link>{' '}
            in the repository.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
