'use client'

/**
 * 📚 DOCUMENTATION HOME
 * =====================
 * 
 * UX rationale: Progressive disclosure — show what matters first.
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Shield, Zap, DollarSign, ArrowRight, Clock,
  Terminal, CheckCircle2, Copy, ExternalLink
} from 'lucide-react'
import { useState } from 'react'

// ===========================================================================
// 🃏 GLASS CARD
// ===========================================================================
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <div 
        className="absolute inset-0 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.8)' }}
      />
      <div 
        className="absolute inset-0 rounded-2xl"
        style={{ 
          border: '1px solid rgba(148,163,184,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ===========================================================================
// 📋 CODE BLOCK
// ===========================================================================
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4 text-slate-400" />
        )}
      </button>
    </div>
  )
}

// ===========================================================================
// 📄 MAIN PAGE
// ===========================================================================
export default function DocsHomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-4">
          <Zap className="h-4 w-4" />
          Quick Start in Minutes
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
          Oxy Documentation
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Control your AI agents with one line of code. This guide will get you 
          from zero to protected in minutes.
        </p>
      </motion.div>

      {/* Quick Start */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard>
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <Terminal className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Quick Start</h2>
                <p className="text-sm text-slate-500">Get protected in 3 steps</p>
              </div>
            </div>

            {/* Step 1 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">1</div>
                <h3 className="font-semibold text-slate-900">Get your API key</h3>
              </div>
              <p className="text-slate-600 mb-3 ml-11">
                Sign up at <Link href="/login" className="text-violet-600 hover:underline">/login</Link> and 
                create your first project. Copy your API key from the dashboard.
              </p>
            </div>

            {/* Step 2 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">2</div>
                <h3 className="font-semibold text-slate-900">Change one line of code</h3>
              </div>
              <p className="text-slate-600 mb-3 ml-11">
                Replace your OpenAI base URL with Oxy's proxy:
              </p>
              <div className="ml-11">
                <CodeBlock 
                  language="python"
                  code={`# Before
client = OpenAI(api_key="sk-...")

# After — just add base_url
client = OpenAI(
    api_key="sk-...",
    base_url="http://localhost:8000/v1"  # ← Add this line
)

# Add your Oxy key to headers
client.default_headers["Authorization"] = "Bearer oxy_sk_..."`}
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">3</div>
                <h3 className="font-semibold text-slate-900">You're protected!</h3>
              </div>
              <p className="text-slate-600 ml-11">
                That's it. Your requests now flow through Oxy. You get:
              </p>
              <ul className="mt-3 ml-11 space-y-2">
                {[
                  'Real-time visibility into all AI actions',
                  'Kill switch to stop any agent in milliseconds',
                  'DLP scanning for leaked secrets',
                  'Budget controls and alerts',
                  'Full audit trail for compliance'
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-slate-600">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Time estimate */}
            <div className="flex items-center gap-2 text-sm text-slate-500 pt-4 border-t border-slate-200">
              <Clock className="h-4 w-4" />
              Average setup time: 4 minutes 32 seconds
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Feature Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Explore Features</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: Shield,
              title: 'Security & Control',
              desc: 'Kill switch, DLP scanning, action blocking',
              href: '/docs/features/kill-switch',
              gradient: 'from-rose-500 to-pink-600'
            },
            {
              icon: DollarSign,
              title: 'Cost Management',
              desc: 'Caching, optimization, attribution, budgets',
              href: '/docs/features/response-caching',
              gradient: 'from-emerald-500 to-teal-600'
            },
            {
              icon: Shield,
              title: 'Security & Operations',
              desc: 'SSO, key rotation, webhooks, compliance',
              href: '/docs/features/sso',
              gradient: 'from-violet-500 to-purple-600'
            },
            {
              icon: Zap,
              title: 'Agent Management',
              desc: 'Agent templates, prompt library, team management',
              href: '/docs/features/agent-templates',
              gradient: 'from-amber-500 to-orange-600'
            },
          ].map((category) => (
            <Link key={category.title} href={category.href}>
              <GlassCard className="h-full hover:scale-[1.02] transition-transform cursor-pointer">
                <div className="p-5">
                  <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${category.gradient} flex items-center justify-center mb-4`}>
                    <category.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{category.title}</h3>
                  <p className="text-sm text-slate-600 mb-3">{category.desc}</p>
                  <span className="text-violet-600 text-sm font-medium flex items-center gap-1">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Support */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassCard>
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Need help?</h3>
              <p className="text-sm text-slate-600">
                Ask in GitHub Discussions or open an issue
              </p>
            </div>
            <div className="flex gap-3">
              <a 
                href="https://github.com/heyvaldemar/oxy-llm-gateway/discussions" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                Discussions <ExternalLink className="h-4 w-4" />
              </a>
              <a 
                href="https://github.com/heyvaldemar/oxy-llm-gateway/issues"
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-xl transition-colors"
              >
                Open an issue
              </a>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}

