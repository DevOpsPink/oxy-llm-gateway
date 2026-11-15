'use client'

/**
 * Footer for the Oxy landing and dashboard pages.
 *
 * Restrained, factual, OSS-appropriate: project identity, links to
 * source / docs / license, maintainer attribution. No stats and no
 * legal-entity phrasing.
 */

import Link from 'next/link'
import { Cpu, Github, ExternalLink } from 'lucide-react'

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'
const MAINTAINER_URL = 'https://heyvaldemar.com'

interface FooterProps {
  variant?: 'default' | 'minimal'
}

export function Footer({ variant = 'default' }: FooterProps) {
  const year = new Date().getFullYear()

  if (variant === 'minimal') {
    return (
      <footer className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {year} Oxy. Apache License 2.0.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href={REPO_URL} className="hover:text-slate-900 transition-colors inline-flex items-center gap-1">
                <Github className="h-3.5 w-3.5" />
                GitHub
              </Link>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
              <Link href="/security" className="hover:text-slate-900 transition-colors">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="h-8 w-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-slate-900">Oxy</span>
            </Link>
            <p className="text-sm text-slate-600 leading-relaxed">
              Self-hosted LLM gateway with budgets, DLP, kill switch, and audit logs.
              Apache License 2.0.
            </p>
          </div>

          {/* Project */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Project</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li>
                <Link href={REPO_URL} className="hover:text-slate-900 transition-colors inline-flex items-center gap-1">
                  Source on GitHub
                  <Github className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link href={`${REPO_URL}/blob/main/docs/getting-started/quickstart.md`} className="hover:text-slate-900 transition-colors">
                  Quickstart
                </Link>
              </li>
              <li>
                <Link href={`${REPO_URL}/blob/main/DEPLOY.md`} className="hover:text-slate-900 transition-colors">
                  Deployment guide
                </Link>
              </li>
              <li>
                <Link href={`${REPO_URL}/issues`} className="hover:text-slate-900 transition-colors">
                  Issues & PRs
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-slate-900 transition-colors">
                  About the maintainers
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Legal & policy</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li>
                <Link href={`${REPO_URL}/blob/main/LICENSE`} className="hover:text-slate-900 transition-colors">
                  Apache License 2.0
                </Link>
              </li>
              <li>
                <Link href={`${REPO_URL}/blob/main/SECURITY.md`} className="hover:text-slate-900 transition-colors">
                  Security model
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-slate-900 transition-colors">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-slate-900 transition-colors">
                  Terms of use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-slate-500">
            © {year} Oxy contributors. Released under{' '}
            <Link href={`${REPO_URL}/blob/main/LICENSE`} className="hover:text-slate-900 underline-offset-2 hover:underline">
              Apache License 2.0
            </Link>
            .
          </p>
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            Maintained by{' '}
            <Link href={MAINTAINER_URL} className="hover:text-slate-900 inline-flex items-center gap-1">
              Vladimir Mikhalev
              <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
