'use client'

/**
 * 🎯 GUARDRAILS DOCUMENTATION
 * ============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Target, CheckCircle2, ArrowRight, Copy, Zap, AlertTriangle } from 'lucide-react'
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

export default function GuardrailsDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Target className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Guardrails</h1>
            <p className="text-slate-500">Set limits on actions, not just money</p>
          </div>
        </div>
      </motion.div>

      {/* Types of guardrails */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Types of Guardrails</h2>
            <div className="space-y-4">
              {[
                { 
                  type: 'Rate Limits', 
                  desc: 'Max requests per minute/hour/day',
                  example: '100 requests/minute per agent'
                },
                { 
                  type: 'Token Limits', 
                  desc: 'Max tokens per request or session',
                  example: '4096 tokens max per request'
                },
                { 
                  type: 'Action Limits', 
                  desc: 'Max tool calls per session',
                  example: '50 tool calls per session'
                },
                { 
                  type: 'Time Limits', 
                  desc: 'Max session duration',
                  example: '30 minutes per session'
                },
              ].map((item) => (
                <div key={item.type} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-900">{item.type}</span>
                    <code className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{item.example}</code>
                  </div>
                  <p className="text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Configure */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Configure Guardrails</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="json"
              code={`// POST /v1/agents
{
  "name": "Customer Support Bot",
  "guardrails": {
    "rate_limit": {
      "requests_per_minute": 100,
      "requests_per_hour": 1000
    },
    "token_limit": {
      "max_tokens_per_request": 4096,
      "max_tokens_per_session": 50000
    },
    "action_limit": {
      "max_tool_calls_per_session": 50,
      "max_file_operations": 10
    },
    "time_limit": {
      "max_session_duration_minutes": 30
    },
    "on_limit_exceeded": "block"  // "block" | "alert" | "throttle"
  }
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* When triggered */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">When a Guardrail is Triggered</h2>
            <CodeBlock 
              language="json"
              code={`// HTTP 429 Too Many Requests
{
  "error": {
    "code": "GUARDRAIL_EXCEEDED",
    "guardrail": "rate_limit",
    "current": 101,
    "limit": 100,
    "window": "1 minute",
    "retry_after_seconds": 45
  }
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Best practices */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h3 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5" /> Recommended Guardrails
          </h3>
          <ul className="space-y-2 text-sm text-emerald-700">
            <li>• <strong>Customer-facing agents:</strong> 100 req/min, 4K tokens, 50 actions</li>
            <li>• <strong>Internal agents:</strong> 500 req/min, 8K tokens, 200 actions</li>
            <li>• <strong>Batch processing:</strong> No rate limit, 32K tokens, 1000 actions</li>
          </ul>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/block-actions" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Block Actions
          </Link>
          <Link href="/docs/features/ai-insights" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: AI Insights <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

