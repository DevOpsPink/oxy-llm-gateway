'use client'

/**
 * ?? AI COST OPTIMIZER DOCUMENTATION
 * ===================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Lightbulb, DollarSign, TrendingDown, CheckCircle2, 
  ArrowRight, Copy, Zap, Brain, BarChart3
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
            <p className="text-slate-500">AI-powered savings recommendations to help reduce spend.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: TrendingDown, label: 'Output', value: 'Ranked actions', color: 'text-emerald-600' },
            { icon: Brain, label: 'Powered by', value: 'Claude', color: 'text-violet-600' },
            { icon: BarChart3, label: 'Analysis Window', value: '30 days', color: 'text-amber-600' },
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
              The AI Cost Optimizer analyzes your last 30 days of usage and provides personalized 
              recommendations to reduce costs without impacting quality.
            </p>
            
            <div className="space-y-4">
              {[
                { step: '1', title: 'Analyze Usage', desc: 'We examine your request patterns, model choices, and token usage' },
                { step: '2', title: 'Identify Patterns', desc: 'Find expensive models used for simple tasks, cacheable requests, etc.' },
                { step: '3', title: 'Generate Recommendations', desc: 'Claude creates specific, actionable cost-saving suggestions' },
                { step: '4', title: 'Estimate Savings', desc: 'Each recommendation includes projected monthly savings' },
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
              Access your personalized recommendations via the dashboard or API:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl http://localhost:8000/api/v1/cost-optimizer/analyze \\
  -H "Authorization: Bearer oxy_sk_..."`}
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
  "analysis_period": "2024-01-01 to 2024-01-31",
  "total_spend": 2847.52,
  "potential_savings": 312.40,
  "recommendations": [
    {
      "id": "rec_001",
      "type": "model_downgrade",
      "title": "Use GPT-3.5 for classification tasks",
      "description": "You're using GPT-4 for 2,340 classification requests. GPT-3.5 achieves 99% same accuracy for this task type.",
      "current_model": "gpt-4",
      "suggested_model": "gpt-3.5-turbo",
      "affected_requests": 2340,
      "estimated_savings_monthly": 187.20,
      "implementation": "Add model routing based on task type"
    },
    {
      "id": "rec_002", 
      "type": "enable_caching",
      "title": "Enable caching for repeated prompts",
      "description": "34% of your requests are identical. Enable response caching to eliminate duplicate API calls.",
      "duplicate_percentage": 34,
      "estimated_savings_monthly": 89.40,
      "implementation": "Set temperature=0 for deterministic outputs"
    },
    {
      "id": "rec_003",
      "type": "prompt_optimization",
      "title": "Reduce system prompt length",
      "description": "Your average system prompt is 847 tokens. Similar prompts achieve same results with 340 tokens.",
      "current_avg_tokens": 847,
      "suggested_avg_tokens": 340,
      "estimated_savings_monthly": 35.80,
      "implementation": "Compress system prompts, move examples to few-shot"
    }
  ]
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Common recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Common Recommendations</h2>
            <div className="space-y-4">
              {[
                { 
                  icon: '??', 
                  title: 'Model Downgrade', 
                  desc: 'Use cheaper models for simple tasks (classification, extraction)',
                  savings: 'Lower per-token cost'
                },
                { 
                  icon: '??', 
                  title: 'Response Caching', 
                  desc: 'Cache identical requests to avoid repeated API calls',
                  savings: 'Fewer provider calls'
                },
                { 
                  icon: '??', 
                  title: 'Prompt Compression', 
                  desc: 'Reduce token count in system prompts',
                  savings: 'Fewer input tokens'
                },
                { 
                  icon: '??', 
                  title: 'Batch Requests', 
                  desc: 'Combine multiple small requests into batches',
                  savings: 'Fewer requests'
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className="text-2xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">{item.savings}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Availability */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
          <Zap className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-violet-800 mb-1">Plan tier</h3>
            <p className="text-sm text-violet-700">
              The optimizer runs for orgs on the growth, business, or enterprise plan tier. The operator
              sets an org&apos;s tier in the database. <Link href="/pricing" className="underline">Plan limits</Link>.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/response-caching" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ? Response Caching
          </Link>
          <Link href="/docs/features/cost-attribution" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Cost Attribution <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

