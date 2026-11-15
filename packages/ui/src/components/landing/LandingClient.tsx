'use client'

/**
 * Oxy landing page — Liquid Glass aesthetic.
 *
 * Factual OSS content (no certification claims, no testimonials, no
 * plans or prices) wrapped in the glassmorphism / aurora visual
 * treatment. Restrained framer-motion
 * entrance animations, no autoplay loops, 60fps on M-series Macs.
 */

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Footer } from '@/components/footer'
import {
  Github,
  ArrowRight,
  Shield,
  Wallet,
  Cpu,
  Eye,
  Workflow,
  Server,
  KeyRound,
  Sparkles,
  DollarSign,
  Zap,
} from 'lucide-react'
import type { ComponentType, SVGProps, ReactNode } from 'react'

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'

// ---------------------------------------------------------------------------
// Aurora background — three soft animated gradient blobs + grid.
// One instance fills the whole page; sections layer their own bg-* on top.
// ---------------------------------------------------------------------------
/**
 * Aurora — Liquid Glass background.
 *
 * Static radial-gradient blobs with breathing opacity-pulse animation
 * (CSS keyframes in globals.css, classes animate-aurora-slow/medium/fast).
 * GPU-accelerated via translateZ(0); no layout/paint thrash. Matches the
 * `prefers-reduced-motion` setting from globals.css.
 *
 * Sizes are viewport-relative (vw) so the same composition scales from
 * iPhone to a 4K display without manual breakpoints.
 */
function Aurora() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" style={{ willChange: 'transform' }}>
      {/* Light base — slight off-white tilt so the colour blobs read properly */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100/95" />

      {/* PRIMARY — violet, top-left */}
      <div
        className="absolute top-[5%] -left-[15%] w-[60vw] h-[60vw] rounded-full animate-aurora-slow"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0.22) 50%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateZ(0)',
          willChange: 'opacity',
        }}
      />

      {/* SECONDARY — fuchsia, top-right */}
      <div
        className="absolute top-[8%] -right-[12%] w-[55vw] h-[55vw] rounded-full animate-aurora-medium"
        style={{
          background: 'radial-gradient(circle, rgba(236,72,153,0.5) 0%, rgba(244,114,182,0.18) 50%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateZ(0)',
          willChange: 'opacity',
        }}
      />

      {/* TERTIARY — cyan, bottom-left */}
      <div
        className="absolute -bottom-[10%] left-[3%] w-[55vw] h-[55vw] rounded-full animate-aurora-fast"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.45) 0%, rgba(34,211,238,0.15) 50%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateZ(0)',
          willChange: 'opacity',
        }}
      />

      {/* QUATERNARY — pink, mid-right (echo of fuchsia, softer) */}
      <div
        className="absolute top-[55%] -right-[10%] w-[42vw] h-[42vw] rounded-full animate-aurora-slow"
        style={{
          background: 'radial-gradient(circle, rgba(244,114,182,0.4) 0%, rgba(244,114,182,0.12) 50%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateZ(0)',
          willChange: 'opacity',
          animationDelay: '3s',
        }}
      />

      {/* Faint grid — adds texture, almost invisible at default zoom */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.022)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Glass-overlay veil — keeps text legible over saturated colour areas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.18) 100%)',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Glass card — frosted background, soft border, gentle lift on hover.
// ---------------------------------------------------------------------------
function GlassCard({
  children,
  className = '',
  hover = true,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative rounded-2xl overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        }}
      />
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          border: '1px solid rgba(148,163,184,0.28)',
          boxShadow: '0 8px 32px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.55)',
        }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// DashboardPreview — fake-but-accurate snapshot of the real dashboard.
//
// Every widget mirrors something the product actually computes:
//   - Budget Usage      → /v1/billing/usage + organization.monthly_budget_usd
//   - Total Requests    → request_logs row count for the current month
//   - DLP detections    → audit_logs filtered by event_type='dlp_block'
//   - Request volume    → request_logs grouped by created_at::date
//
// Numbers are illustrative sample data, so visitors can see the product
// surface without signing up.
// ---------------------------------------------------------------------------
function DashboardPreview() {
  // Deterministic-looking but irregular bar heights for the 30-day volume chart.
  const bars = [40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95, 70, 65, 80, 55, 70, 85, 60, 75, 90, 65, 80, 70, 60, 88, 72, 55, 78, 92]

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, type: 'spring', stiffness: 50 }}
      className="relative mx-auto max-w-5xl"
    >
      {/* Aurora halo behind the dashboard — same colour family as hero CTA */}
      <div className="absolute -inset-8 lg:-inset-12 rounded-[2.5rem] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-pink-500/25 blur-3xl pointer-events-none" />

      <GlassCard hover={false} className="relative">
        <div className="p-1.5">
          {/* Window chrome */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/60">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-sm shadow-violet-500/30">
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-900">Oxy Dashboard</span>
              <span className="hidden sm:inline text-xs text-slate-400 font-mono">acme-prod</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700">All systems operational</span>
            </div>
          </div>

          {/* KPI grid + volume chart */}
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Budget Usage */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-5 rounded-xl bg-white/55 border border-white/70 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Budget usage</span>
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900 tracking-tight">$127.50</div>
              <div className="text-[11px] text-slate-500 mt-1">of $500.00 monthly cap</div>
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '25.5%' }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.9, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 text-right font-mono">25.5%</div>
            </motion.div>

            {/* Total Requests */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.28 }}
              className="p-5 rounded-xl bg-white/55 border border-white/70 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Total requests</span>
                <Zap className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900 tracking-tight">12,847</div>
              <div className="text-[11px] text-slate-500 mt-1">May 2026, month-to-date</div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  ▲ 18.2%
                </span>
                <span className="text-[10px] text-slate-400">vs. April</span>
              </div>
            </motion.div>

            {/* DLP — fits the green "safety" slot in the original */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.36 }}
              className="p-5 rounded-xl bg-gradient-to-br from-emerald-50/95 via-emerald-50/70 to-teal-50/40 border border-emerald-200/60 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-700 font-semibold">DLP blocks</span>
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-semibold text-emerald-700 tracking-tight">23</div>
              <div className="text-[11px] text-emerald-600/90 mt-1">Cards, secrets, emails redacted</div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-emerald-700/80">last: 4 min ago</span>
              </div>
            </motion.div>

            {/* Volume chart */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.45 }}
              className="sm:col-span-3 p-5 rounded-xl bg-white/55 border border-white/70 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Request volume · 30 days</span>
                <span className="text-[10px] text-slate-400 font-mono">avg 428 req/day</span>
              </div>
              <div className="flex items-end gap-[3px] h-20">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.55 + i * 0.018, duration: 0.4, ease: 'easeOut' }}
                    className="flex-1 bg-gradient-to-t from-violet-500/95 via-fuchsia-500/85 to-pink-400/90 rounded-t-sm"
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-mono">
                <span>Apr 28</span>
                <span>May 12</span>
                <span>May 27</span>
              </div>
            </motion.div>
          </div>
        </div>
      </GlassCard>

      <p className="mt-4 text-center text-[11px] text-slate-500">
        Illustrative — figures reflect real product surface, not customer data.
      </p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Feature data — same as before, now rendered as Glass cards.
// ---------------------------------------------------------------------------
const features: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; body: string }[] = [
  {
    icon: Wallet,
    title: 'Budgets and kill switch',
    body: 'A spend cap per project, reserved atomically before a request reaches the provider, with optional cost-spike auto-suspend. A dedicated kill path stops misbehaving agent sessions on demand.',
  },
  {
    icon: Shield,
    title: 'DLP and privacy modes',
    body: 'Regex-based detection of cards, API-key-like strings, and emails before requests leave the gateway. Switch between zero-prompt, metadata-only, and debug logging.',
  },
  {
    icon: Eye,
    title: 'Audit logs and cost attribution',
    body: 'Tag spend by customer, team, or feature. Export CSVs for finance. Configurable retention windows on request logs.',
  },
  {
    icon: Cpu,
    title: 'OpenAI-compatible API',
    body: 'A single /v1/chat/completions endpoint routes to OpenAI, Anthropic, Gemini, Ollama, vLLM, or any OpenAI-compatible upstream — streaming and non-streaming.',
  },
  {
    icon: Workflow,
    title: 'Webhooks and integrations',
    body: 'Best-effort outbound webhooks for Slack, Discord, Zapier and your own endpoints, configured per organization.',
  },
  {
    icon: KeyRound,
    title: 'Self-hosted by default',
    body: 'Postgres + PostgREST + GoTrue + Redis run on your machine via docker-compose. No cloud accounts; an optional hosted-Supabase mode is supported for production.',
  },
]

const stack: { label: string; value: string }[] = [
  { label: 'Backend', value: 'FastAPI (Python 3.12), structlog, atomic Redis Lua scripts' },
  { label: 'Frontend', value: 'Next.js (App Router), TypeScript strict, Tailwind, Radix' },
  { label: 'Data', value: 'Postgres 16, PostgREST 12, GoTrue v2, Redis 7' },
  { label: 'Infra', value: 'docker-compose, nginx (URL-shape adapter), Caddy for prod TLS' },
  { label: 'Tests', value: '427 offline pytest cases, Vitest + Playwright on the UI' },
]

const comparison = [
  ['Self-hosted (docker compose up)',  'yes',         'yes',     'no',           'open-source core, hosted UI'],
  ['OpenAI-compatible API',            'yes',         'yes',     'yes',          'yes'],
  ['Pre-provider DLP scanning',         'yes',         'limited', 'no',           'yes'],
  ['Response caching',                 'AES-encrypted','yes',     'exact-text',   'yes'],
  ['Audit logs with CSV export',       'yes',         'plugin',  'logpush',      'yes'],
  ['Dashboard included',               'yes',         'enterprise','yes',        'yes'],
  ['Cost analytics + attribution',     'yes',         'limited', 'limited',      'yes'],
  ['Vendor lock-in',                   'none',        'none',    'Cloudflare',   'now PANW'],
  ['License',                          'Apache 2.0',  'MIT',     'proprietary',  'MIT gateway core (pre-acquisition)'],
] as const

const faq = [
  {
    q: 'Does it work with my existing OpenAI / Anthropic / Gemini key?',
    a: 'Yes — that is the default path. You add your provider key under Settings → Providers in the dashboard (or set the corresponding env var), and the gateway proxies your requests to that provider. The OpenAI SDK works unchanged; just point `base_url` at the gateway.',
  },
  {
    q: 'Does streaming (SSE) work?',
    a: 'Yes for real providers — the gateway forwards SSE chunks from OpenAI / Anthropic / Gemini without buffering. Local providers (Ollama, vLLM) stream when the backend itself does.',
  },
  {
    q: 'Why open-source now?',
    a: 'The category consolidated upward in 2026. Portkey was acquired by Palo Alto Networks; Helicone by Mintlify. The code base is more useful as a reference implementation other teams can learn from and fork than sitting in a private repo.',
  },
  {
    q: 'Is BYOK secure? Where are provider keys stored?',
    a: 'Provider keys are encrypted at rest via the vault schema in Postgres (pgcrypto AES). Decryption happens only inside the engine container at request time. Browser code never sees them. On a self-hosted deployment you own the encryption key; review db/supabase-compat.sql for the exact scheme.',
  },
  {
    q: 'How much does it cost me to run?',
    a: 'Infrastructure cost: roughly €5/month for a small Hetzner VPS hosting the full stack (Postgres + PostgREST + GoTrue + Redis + engine + UI). LLM provider costs pass through to your own account — Oxy does not mark up tokens.',
  },
  {
    q: 'Can I put real traffic through it?',
    a: 'It is a reference implementation, not a contracted service. The offline engine test suite passes, an end-to-end smoke through a real provider (Anthropic) has been run, and the stack follows operational patterns the maintainers have run elsewhere. There are no SLAs at any layer. Review SECURITY.md and DEPLOY.md before pointing it at production traffic.',
  },
  {
    q: 'Can I fork this and run it as a hosted service?',
    a: 'Yes — Apache License 2.0 permits commercial use. An optional Stripe module is included if you bill your own customers; you will still need to stand up the operational pieces (SMTP, monitoring, support). The plan tiers in code are quota defaults, not prices.',
  },
  {
    q: 'How does it differ from running LiteLLM behind nginx?',
    a: 'Overlapping core (OpenAI-compatible proxy across providers). Where Oxy adds value: a dashboard for keys + budgets + audit, atomic Redis-Lua budget reservations, response cache with AES-encrypted payloads, pre-provider DLP, and a multi-tenant Postgres schema with row-level security. Where LiteLLM is stronger: more provider coverage, larger community, wider use at scale.',
  },
]

// ---------------------------------------------------------------------------
// LandingClient
// ---------------------------------------------------------------------------
export default function LandingClient() {
  return (
    <div className="relative min-h-screen bg-white text-slate-900">
      <Aurora />

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Server className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">Oxy</span>
            <span className="text-xs text-slate-500 hidden sm:inline">— self-hosted LLM gateway</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={REPO_URL}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/login?signup=1">
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400 text-white shadow-md shadow-violet-500/30">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="relative">
          <div className="container mx-auto px-6 pt-20 pb-16 lg:pt-32 lg:pb-20 w-full">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-5xl mx-auto text-center"
            >
              {/* Reference badge */}
              <GlassCard hover={false} className="inline-flex mb-8">
                <span className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 tracking-wider uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  Reference implementation
                  <span className="text-slate-300">·</span>
                  Apache 2.0
                </span>
              </GlassCard>

              {/* Massive hero title */}
              <h1 className="text-[40px] leading-[1.05] sm:text-6xl md:text-7xl lg:text-[88px] lg:leading-[1.02] xl:text-[104px] font-semibold tracking-[-0.03em] text-slate-900">
                A self-hosted LLM gateway with{' '}
                <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                  budgets, DLP, and a&nbsp;kill switch.
                </span>
              </h1>

              <p className="mt-8 text-lg sm:text-xl lg:text-2xl text-slate-600 leading-[1.5] max-w-3xl mx-auto font-light">
                One OpenAI-compatible endpoint in front of OpenAI, Anthropic, Gemini, Ollama, and
                vLLM. Budgets, response caching, audit logs, cost attribution.
                Runs end-to-end on{' '}
                <code className="text-base bg-slate-100/80 border border-slate-200/80 px-2 py-0.5 rounded-md font-mono">
                  docker compose up
                </code>
                {' '}— no cloud accounts.
              </p>

              <div className="mt-10 flex flex-wrap gap-4 justify-center">
                <Link href={REPO_URL}>
                  <div className="group relative">
                    <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 opacity-60 blur-lg group-hover:opacity-90 transition-opacity" />
                    <Button size="lg" className="relative h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                      <Github className="h-5 w-5 mr-2" />
                      View on GitHub
                    </Button>
                  </div>
                </Link>
                <Link href="/login?signup=1">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 px-8 text-base border-slate-300 bg-white/70 backdrop-blur-xl rounded-xl shadow-sm"
                  >
                    Try the dashboard
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── DASHBOARD PREVIEW ─────────────────────────────────────────── */}
        <section className="relative">
          <div className="container mx-auto px-6 pb-20 lg:pb-24">
            <DashboardPreview />
          </div>
        </section>

        {/* ── STATS STRIP ───────────────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-14 lg:py-20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-8 max-w-4xl mx-auto">
              {[
                ['311',         'offline tests'],
                ['5',           'LLM providers'],
                ['14',          'containers'],
                ['Apache 2.0',  'license'],
              ].map(([n, label]) => (
                <div key={label} className="text-center">
                  <div className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-[-0.02em] bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
                    {n}
                  </div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-slate-500 mt-2 font-medium">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TERMINAL SHOWCASE ─────────────────────────────────────────── */}
        <section className="relative">
          <div className="container mx-auto px-6 pb-24 lg:pb-32">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
              className="relative max-w-5xl mx-auto"
            >
              <div className="absolute -inset-6 lg:-inset-10 rounded-[2rem] bg-gradient-to-br from-violet-500/40 via-fuchsia-500/30 to-pink-500/35 blur-3xl" />
              <div className="relative rounded-2xl border border-slate-800/80 bg-slate-950/98 shadow-2xl shadow-violet-900/30 overflow-hidden">
                {/* Terminal chrome */}
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800/70 bg-slate-900/60">
                  <div className="flex gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/90" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/90" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/90" />
                  </div>
                  <span className="ml-3 text-xs text-slate-400 font-mono">
                    curl http://localhost:8000 — chat.completions
                  </span>
                </div>
                {/* Terminal body */}
                <pre className="px-6 py-7 lg:px-10 lg:py-10 text-[13.5px] lg:text-[14.5px] leading-[1.85] font-mono text-slate-300 overflow-x-auto">
<span className="text-emerald-400">$</span> curl -X POST localhost:8000/v1/chat/completions {'\\'}
{'  '}<span className="text-sky-400">-H</span> <span className="text-amber-300">{'"Authorization: Bearer $OXY_KEY"'}</span> {'\\'}
{'  '}<span className="text-sky-400">-d</span> <span className="text-amber-300">{`'{"model": "claude-haiku-4-5",`}</span>
{'        '}<span className="text-amber-300">{`"messages": [{"role": "user", "content": "hi"}]}'`}</span>

<span className="text-violet-400">{'// gateway → budget reservation → DLP scan → provider call'}</span>
<span className="text-violet-400">{'// → cost recorded → audit log → response returned'}</span>

{'{'}
{'  "id": "chatcmpl-msg_01ER7qtX2s4yEys6m3rgbqbN",'}
{'  "model": "claude-haiku-4-5",'}
{'  "choices": [{'}
{'    "message": { "role": "assistant", "content": '}<span className="text-emerald-300">{'"Hi there!"'}</span>{' }'}
{'  }],'}
{'  "usage": '}<span className="text-emerald-300">{'{ "prompt_tokens": 18, "completion_tokens": 5 }'}</span>
{'}'}

<span className="text-violet-400">{'→ request_logs: cost_usd=$0.000054, latency_ms=412'}</span>
                </pre>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── QUICKSTART ────────────────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-28 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em]">
                Run it in{' '}
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                  a minute
                </span>
              </h2>
              <p className="mt-3 text-slate-600">
                Fourteen containers, local defaults. Dashboard at{' '}
                <code className="text-sm bg-slate-100/80 border border-slate-200/80 px-1.5 py-0.5 rounded">
                  localhost:3000
                </code>
                , gateway at{' '}
                <code className="text-sm bg-slate-100/80 border border-slate-200/80 px-1.5 py-0.5 rounded">
                  localhost:8000
                </code>
                . The same call, in your language of choice:
              </p>

              <GlassCard hover={false} className="mt-7">
                <div className="p-2">
                  <Tabs defaultValue="curl">
                    <TabsList className="bg-transparent border-b border-slate-200/70 rounded-none w-full justify-start px-3">
                      <TabsTrigger value="curl">curl</TabsTrigger>
                      <TabsTrigger value="python">Python</TabsTrigger>
                      <TabsTrigger value="typescript">TypeScript</TabsTrigger>
                      <TabsTrigger value="node">Node.js</TabsTrigger>
                    </TabsList>

                    <TabsContent value="curl" className="mt-0">
                      <pre className="rounded-xl bg-slate-950 text-slate-100 text-sm p-5 overflow-x-auto leading-relaxed font-mono m-3">
{`# Boot the stack
git clone ${REPO_URL.replace('https://', '')}.git && cd oxy
docker compose up

# Sign up at http://localhost:3000/login, copy your $OXY_API_KEY
curl -X POST http://localhost:8000/v1/chat/completions \\
  -H "Authorization: Bearer $OXY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [{"role":"user","content":"hi from oxy"}]
  }'`}
                      </pre>
                    </TabsContent>

                    <TabsContent value="python" className="mt-0">
                      <pre className="rounded-xl bg-slate-950 text-slate-100 text-sm p-5 overflow-x-auto leading-relaxed font-mono m-3">
{`# Drop-in replacement for the OpenAI SDK — point base_url at Oxy.
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="$OXY_API_KEY",
)

resp = client.chat.completions.create(
    model="claude-haiku-4-5",
    messages=[{"role": "user", "content": "hi from oxy"}],
)
print(resp.choices[0].message.content)`}
                      </pre>
                    </TabsContent>

                    <TabsContent value="typescript" className="mt-0">
                      <pre className="rounded-xl bg-slate-950 text-slate-100 text-sm p-5 overflow-x-auto leading-relaxed font-mono m-3">
{`// Works with the official OpenAI SDK — just swap the baseURL.
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: process.env.OXY_API_KEY,
});

const resp = await client.chat.completions.create({
  model: "claude-haiku-4-5",
  messages: [{ role: "user", content: "hi from oxy" }],
});

console.log(resp.choices[0].message.content);`}
                      </pre>
                    </TabsContent>

                    <TabsContent value="node" className="mt-0">
                      <pre className="rounded-xl bg-slate-950 text-slate-100 text-sm p-5 overflow-x-auto leading-relaxed font-mono m-3">
{`// Plain Node 22 fetch — no SDK needed.
const res = await fetch("http://localhost:8000/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.OXY_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5",
    messages: [{ role: "user", content: "hi from oxy" }],
  }),
});

const json = await res.json();
console.log(json.choices[0].message.content);`}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>
              </GlassCard>

              <p className="mt-4 text-sm text-slate-500">
                Full walkthrough in{' '}
                <Link href={`${REPO_URL}/blob/main/docs/getting-started/quickstart.md`} className="text-violet-600 hover:underline font-medium">
                  docs/getting-started/quickstart.md
                </Link>
                .
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── FEATURES (Glass cards) ────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-28 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mb-12"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em]">
                What it{' '}
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                  does
                </span>
              </h2>
              <p className="mt-3 text-slate-600">
                Every feature is heuristic / best-effort — no SLAs. See{' '}
                <Link href={`${REPO_URL}/blob/main/docs/product/FEATURE_MATRIX.yml`} className="text-violet-600 hover:underline font-medium">
                  FEATURE_MATRIX.yml
                </Link>{' '}
                for the canonical mapping between feature, code, tests, and docs.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map(({ icon: Icon, title, body }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                >
                  <GlassCard className="h-full">
                    <div className="p-6">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center mb-4">
                        <Icon className="h-5 w-5 text-violet-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900">{title}</h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMPARISON ────────────────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-28 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mb-10"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em]">
                How it{' '}
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                  compares
                </span>
              </h2>
              <p className="mt-3 text-slate-600">
                The AI-gateway category consolidated upward in 2026: Portkey was acquired by Palo Alto
                Networks, Helicone by Mintlify. Self-hosted alternatives exist; the rough trade-offs:
              </p>
            </motion.div>

            <GlassCard hover={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/70">
                      <th className="text-left py-4 px-5 font-semibold text-slate-700 w-44">&nbsp;</th>
                      <th className="text-left py-4 px-5 font-semibold">
                        <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                          Oxy
                        </span>{' '}
                        <span className="text-xs text-slate-500 font-normal">this repo</span>
                      </th>
                      <th className="text-left py-4 px-5 font-semibold text-slate-700">
                        LiteLLM <span className="text-xs text-slate-500 font-normal">OSS</span>
                      </th>
                      <th className="text-left py-4 px-5 font-semibold text-slate-700">
                        Cloudflare AI Gateway <span className="text-xs text-slate-500 font-normal">hosted</span>
                      </th>
                      <th className="text-left py-4 px-5 font-semibold text-slate-700">
                        Portkey <span className="text-xs text-slate-500 font-normal">acq. PANW</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {comparison.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100/70 last:border-b-0 hover:bg-slate-50/50">
                        <td className="py-3.5 px-5 font-medium text-slate-900">{row[0]}</td>
                        <td className="py-3.5 px-5 font-medium text-violet-700">{row[1]}</td>
                        <td className="py-3.5 px-5">{row[2]}</td>
                        <td className="py-3.5 px-5">{row[3]}</td>
                        <td className="py-3.5 px-5">{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
            <p className="mt-5 text-xs text-slate-500 max-w-3xl">
              Rough public-information comparison as of May 2026; check each project for the current
              state. Inclusion is not endorsement. The honest read: if you already run Cloudflare for
              everything, their AI Gateway is hard to beat on convenience. If you cannot have a vendor
              between you and the LLM provider, self-hosted is the answer — Oxy or LiteLLM.
            </p>
          </div>
        </section>

        {/* ── ARCHITECTURE + STACK ──────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-28 lg:py-36">
            <div className="grid lg:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em] mb-5">
                  Architecture
                </h2>
                <p className="text-slate-600 mb-6">
                  One docker network. PostgREST and GoTrue replace the equivalent
                  Supabase Cloud services, sharing one JWT secret so tokens flow through RLS unchanged.
                </p>
                <GlassCard hover={false}>
                  <pre className="text-xs md:text-sm p-6 overflow-x-auto leading-snug text-slate-700 font-mono">
{`Browser ─▶ UI (Next.js :3000)
              │
              ▼
        nginx :8080 (URL adapter)
        ├─ /auth/v1/* ─▶ GoTrue
        └─ /rest/v1/* ─▶ PostgREST
                          │
                          ▼
                   Postgres 16 (schema + RLS)

API ─▶ Engine (FastAPI :8000)
        ├─▶ Redis (cache, budgets)
        └─▶ OpenAI / Anthropic / Gemini
            / Ollama / vLLM`}
                  </pre>
                </GlassCard>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em] mb-5">
                  Stack
                </h2>
                <p className="text-slate-600 mb-6">
                  Conservative, boring choices. Every layer is open-source and inspectable.
                </p>
                <GlassCard hover={false}>
                  <dl className="p-6 space-y-4">
                    {stack.map(({ label, value }) => (
                      <div key={label} className="grid grid-cols-[100px_1fr] gap-4 items-baseline">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                          {label}
                        </dt>
                        <dd className="text-sm text-slate-700 leading-relaxed">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </GlassCard>
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <span>311 offline tests · Apache 2.0 · docker compose up</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-28 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em]">
                Frequent{' '}
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                  questions
                </span>
              </h2>
              <p className="mt-3 text-slate-600">
                The questions that come up first when teams evaluate this kind of layer.
              </p>

              <div className="mt-8 space-y-3">
                {faq.map(({ q, a }, i) => (
                  <GlassCard hover={false} key={i}>
                    <details className="group">
                      <summary className="flex items-start justify-between gap-4 cursor-pointer list-none p-5">
                        <span className="font-medium text-slate-900 leading-snug pr-4">{q}</span>
                        <span className="text-violet-600 text-xl leading-none mt-0.5 group-open:rotate-45 transition-transform duration-200 shrink-0">
                          +
                        </span>
                      </summary>
                      <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{a}</p>
                    </details>
                  </GlassCard>
                ))}
              </div>

              <p className="mt-6 text-sm text-slate-500">
                More in{' '}
                <Link href={`${REPO_URL}/blob/main/docs/getting-started/quickstart.md`} className="text-violet-600 hover:underline font-medium">
                  the quickstart
                </Link>
                {' '}and{' '}
                <Link href={`${REPO_URL}/blob/main/DEPLOY.md`} className="text-violet-600 hover:underline font-medium">
                  the deployment guide
                </Link>
                .
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── MAINTAINERS (mini) ────────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-14">
            <GlassCard hover={false}>
              <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    <Image
                      src="/founders/vladimir-mikhalev.webp"
                      alt="Vladimir Mikhalev"
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-md"
                    />
                    <Image
                      src="/founders/tatiana-mikhaleva.webp"
                      alt="Tatiana Mikhaleva"
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-md"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Built by Vladimir Mikhalev &amp; Tatiana Mikhaleva
                    </p>
                    <p className="text-sm text-slate-600">
                      The DevOps engineers behind heyvaldemar.com and devops.pink
                    </p>
                  </div>
                </div>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 whitespace-nowrap"
                >
                  Read more
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ── CLOSING ───────────────────────────────────────────────────── */}
        <section className="relative border-t border-slate-200/70">
          <div className="container mx-auto px-6 py-28 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em]">About this project</h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                Oxy is an open-source LLM gateway under the Apache License 2.0, maintained as a
                reference implementation for teams building or evaluating their own LLM ops
                infrastructure.
              </p>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Maintained by{' '}
                <Link href="https://heyvaldemar.com" className="text-violet-600 hover:underline font-medium">
                  Vladimir Mikhalev
                </Link>{' '}
                (heyvaldemar). Issues and PRs welcome at{' '}
                <Link href={REPO_URL} className="text-violet-600 hover:underline font-medium">
                  github.com/heyvaldemar/oxy-llm-gateway
                </Link>
                .
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={REPO_URL}>
                  <div className="group relative">
                    <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 opacity-50 blur-md group-hover:opacity-75 transition-opacity" />
                    <Button size="lg" className="relative bg-slate-900 hover:bg-slate-800 text-white">
                      <Github className="h-4 w-4 mr-2" />
                      Source on GitHub
                    </Button>
                  </div>
                </Link>
                <Link href={`${REPO_URL}/blob/main/SECURITY.md`}>
                  <Button size="lg" variant="outline" className="border-slate-300 bg-white/60 backdrop-blur">
                    Security model
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
