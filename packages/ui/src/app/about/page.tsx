import { Metadata } from 'next'
import Link from 'next/link'
import { FoundersSection } from '@/components/marketing/founders-section'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — Oxy',
  description:
    'Oxy was built by Vladimir Mikhalev and Tatiana Mikhaleva, the DevOps engineers behind heyvaldemar.com and devops.pink.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/about` },
}

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
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

      <main>
        <section className="container mx-auto px-6 pt-16 pb-8">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
              Maintainers
            </span>
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              About Oxy
            </h1>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Oxy is an open-source LLM gateway released under the Apache
              License 2.0. The code is maintained as a reference
              implementation for teams building or evaluating their own LLM
              ops infrastructure.
            </p>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Both authors are DevOps engineers with a public body of work
              around Docker, Kubernetes, CI/CD, and platform engineering. The
              core gateway logic — atomic budget reservations, response cache,
              DLP, audit logs, the Postgres + PostgREST + GoTrue self-hosted
              path — reflects roughly twenty combined years of operating
              production systems.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={REPO_URL}>
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white">
                  <Github className="h-4 w-4 mr-2" />
                  Source on GitHub
                </Button>
              </Link>
              <Link href="/">
                <Button size="lg" variant="outline">
                  Back to project
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <FoundersSection />
      </main>

      <Footer />
    </div>
  )
}
