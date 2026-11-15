'use client'

/**
 * COST OPTIMIZER DOCUMENTATION
 * ===================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Lightbulb, TrendingDown, CheckCircle2, 
  ArrowRight, Copy, Zap, BarChart3, Info
} from 'lucide-react'
import { useState } from 'react'

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(255,255,255,0.8)' }} />
      <div className="absolute inset-0 rounded-2xl" style={{ border: '1px solid rgba(148,163,184,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group">
      <div className="absolute top-3 left-4 text-xs text-slate-500 font-mono">{language}</div>
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 pt-8 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
      <button onClick={handleCopy} className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
      </button>
    </div>
  )
}

export default function CostOptimizerDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
            <Lightbulb className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">AI Cost Optimizer</h1>
            <p className="text-slate-500">Rule-based savings estimates from your request logs. No model is called.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: TrendingDown, label: 'Output', value: 'Up to 3 estimates', color: 'text-emerald-600' },
            { icon: Zap, label: 'Method', value: 'Fixed rules', color: 'text-violet-600' },
            { icon: BarChart3, label: 'Analysis Window', value: '7 or 30 days', color: 'text-amber-600' },
          ].map((stat) => (
            <GlassCard key={stat.label}>
              <div className="p-4 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-slate-600 mb-4">
              The optimizer groups your organization&apos;s <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">request_logs</code> rows
              in the window by model and provider, then applies three fixed rules. It does not read prompts or measure
              quality, and it changes nothing.
            </p>
            
            <div className="space-y-4">
              {[
                { step: '1', title: 'Aggregate Usage', desc: 'Per model and provider: total cost, request count, and average prompt and completion tokens (at most 200 groups).' },
                { step: '2', title: 'Model Switch', desc: 'The costliest model with a cheaper alternative in a fixed list (gpt-4.1 or gpt-4 → gpt-4.1-mini, claude-3-opus → claude-3-sonnet, claude-3.5-sonnet → claude-3-haiku). Assumes half its requests could move and prices both models from the pricing table.' },
                { step: '3', title: 'Caching', desc: 'Assumes 15% duplicate requests if the costliest group has more than 50 requests (5% otherwise) and a 20% saving on those. Duplicates are not measured.' },
                { step: '4', title: 'Throttling', desc: 'The first group with more than 100 requests averaging under $0.0005 each; estimates 5% of its cost.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Get recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Get Recommendations</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">GET /v1/cost-optimizer/recommendations</code> takes
              an Oxy API key or the dashboard&apos;s signed-in session (the dashboard&apos;s Optimizer page uses it).
              <code> window</code> is <code>7d</code> or <code>30d</code> (default <code>30d</code>);
              <code> limit</code> is 1 to 50 (default 10). Other values get a 422.
            </p>
            <CodeBlock 
              language="bash"
              code={`curl "http://localhost:8000/v1/cost-optimizer/recommendations?window=30d" \\
  -H "Authorization: Bearer oxy_live_..."`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Example response */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Example Response</h2>
            <CodeBlock 
              language="json"
              code={`{
  "window": "30d",
  "currency": "USD",
  "estimates_only": true,
  "data_source": "request_logs",
  "data_window_start": "2026-10-16T12:00:00+00:00",
  "estimated_total_savings_usd": 41.27,
  "recommendations": [
    {
      "type": "model_switch",
      "title": "Heuristic: move low-risk gpt-4 traffic to gpt-4.1-mini",
      "description": "About half of gpt-4 requests look low-creative. Switching those to gpt-4.1-mini could reduce spend; estimate only.",
      "estimated_monthly_savings_usd": 38.9,
      "confidence": "medium",
      "affected_models": ["gpt-4", "gpt-4.1-mini"],
      "supporting_stats": {
        "requests": 1200,
        "avg_prompt_tokens": 410.5,
        "avg_completion_tokens": 120.2
      }
    },
    {
      "type": "enable_caching",
      "title": "Enable response caching for repeated prompts",
      "description": "Traffic appears repetitive. Caching similar prompts could trim duplicate calls (estimate only).",
      "estimated_monthly_savings_usd": 2.37,
      "confidence": "high",
      "supporting_stats": {
        "duplicate_ratio": 0.15,
        "requests_sampled": 1200
      }
    }
  ]
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              Recommendations are sorted by estimated savings. Despite its name,
              <code> estimated_monthly_savings_usd</code> is computed from the cost in the chosen window, so with
              <code> window=7d</code> it is a 7-day figure.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Common recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Recommendation Types</h2>
            <div className="space-y-4">
              {[
                { 
                  icon: TrendingDown, 
                  title: 'model_switch', 
                  desc: 'Move part of one model\'s traffic to a cheaper model from the fixed list',
                  savings: 'Confidence: medium'
                },
                { 
                  icon: Zap, 
                  title: 'enable_caching', 
                  desc: 'Turn on response caching for repeated prompts',
                  savings: 'Confidence: high or medium'
                },
                { 
                  icon: BarChart3, 
                  title: 'rate_limit', 
                  desc: 'Throttle high-volume, low-cost traffic',
                  savings: 'Confidence: low'
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl">
                  <item.icon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900"><code>{item.title}</code></div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">{item.savings}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Advisory */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
          <Info className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-violet-800 mb-1">Estimates only</h3>
            <p className="text-sm text-violet-700">
              Every figure comes from the fixed ratios above applied to logged cost, not from a test of your traffic.
              Treat the output as a prompt to look closer. With no logged requests in the window, the list is empty.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/response-caching" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Response Caching
          </Link>
          <Link href="/docs/features/cost-attribution" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Cost Attribution <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
