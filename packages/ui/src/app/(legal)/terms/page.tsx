import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'
import { Scale } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms — Oxy',
  description:
    'Oxy is released under Apache License 2.0. This page summarises what that means for users and operators of the reference implementation.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/terms` },
}

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to overview
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <Scale className="h-6 w-6 text-violet-600" />
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Terms</h1>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 leading-relaxed">
          Oxy is open-source software released under the Apache License, Version 2.0. The full
          legal text is in{' '}
          <Link href={`${REPO_URL}/blob/main/LICENSE`} className="underline font-medium">
            LICENSE
          </Link>
          ; this page is a plain-English summary, not a substitute.
        </div>

        <section className="mt-10 prose prose-slate max-w-none">
          <h2>License grant</h2>
          <p>
            You may use, copy, modify, distribute, and sell the software for any purpose, commercial
            or non-commercial, subject to the Apache 2.0 conditions: include the license text in
            redistributions, state any significant changes you made, and keep the existing copyright
            and patent notices intact.
          </p>

          <h2>Patent grant</h2>
          <p>
            Each contributor grants you a perpetual, worldwide patent license to use their
            contributions to Oxy. If you sue any contributor (or any user) for patent infringement
            over the software, your patent license terminates automatically.
          </p>

          <h2>No warranty</h2>
          <p>
            Oxy is provided <strong>as is</strong>, without warranty of any kind — express or implied. There is no
            guarantee that the gateway is fit for any particular purpose, error-free, secure, or
            compliant with any specific standard. Heuristic signals (cost optimiser, intelligence,
            anomaly detection, security score) are advisory only and not billing truth.
          </p>

          <h2>No SLA</h2>
          <p>
            Uptime, latency, retention, savings, and security guarantees are not commitments at any
            level of the codebase. If you need contractual terms, you will have to negotiate them
            separately with whoever is operating the deployment you depend on.
          </p>

          <h2>Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, no contributor is liable to you for
            any direct, indirect, special, incidental, or consequential damages arising from your
            use of Oxy — even if a contributor was advised of the possibility of such damages.
          </p>

          <h2>If you operate Oxy for users</h2>
          <p>
            You are responsible for your own terms of service, acceptable use policy, billing,
            support, and any compliance obligations toward your users. The reference implementation
            includes scaffolding (plan tiers, Stripe wiring, audit logs) that you can adapt; none of
            it is a substitute for terms you negotiate yourself.
          </p>

          <h2>Trademarks</h2>
          <p>
            The Apache 2.0 license does not grant trademark rights. "Oxy" and any associated logos
            may be used to describe the software, but not to imply endorsement of a derivative work
            or to brand a competing product.
          </p>

          <h2>Contact</h2>
          <p>
            For source, issues, and pull requests visit{' '}
            <Link href={REPO_URL} className="underline">{REPO_URL.replace('https://', '')}</Link>.
            For project maintainer contact see{' '}
            <Link href="https://heyvaldemar.com" className="underline">heyvaldemar.com</Link>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
