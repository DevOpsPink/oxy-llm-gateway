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
            <p className="text-slate-500">Organization kill switch and cost-spike auto-suspend</p>
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
                  type: 'Kill switch (paused)',
                  desc: 'Setting "paused": true suspends the whole organization. /v1/chat/completions then refuses its requests with 403 org_suspended until paused is set back to false.',
                  example: 'paused: false by default'
                },
                {
                  type: 'Cost-spike auto-suspend',
                  desc: 'The cost anomaly worker checks every 5 minutes. When a project\'s spend in the last hour reaches 100x its 30-day hourly average and this flag is on, it suspends the organization (reason cost_spike) and the project.',
                  example: 'auto_suspend_on_cost_spikes: true by default'
                },
                {
                  type: 'Burst rate limit',
                  desc: 'Requests per second per user on /v1/chat/completions. Over the limit: 429 RATE_LIMITED with retry_after 1.',
                  example: 'BURST_LIMIT_PER_SECOND=10'
                },
                {
                  type: 'Per-agent limits (stored, not enforced)',
                  desc: 'POST /v1/agents saves max_tokens_per_request, max_requests_per_session and max_tool_calls_per_session on the agent. The gateway does not read them in this build.',
                  example: 'defaults 4096 / 100 / 50'
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
              code={`// GET  /v1/guardrails   reads the current state
// POST /v1/guardrails   changes it; send only the fields to change
// Both take an Oxy API key (Authorization: Bearer oxy_live_...) or the dashboard's session;
// POST needs an owner or admin of the organization (403 otherwise)
{
  "paused": true,
  "auto_suspend_on_cost_spikes": true
}

// Response (both methods): the organization's guardrail state
{
  "status": "suspended",
  "suspended_until": null,
  "suspend_reason": "manual_toggle",
  "paused": true,
  "auto_suspend_on_cost_spikes": true,
  "last_paused_at": "2026-01-01T00:00:00+00:00",
  "last_pause_reason": "manual_toggle"
}`}
            />
            <p className="text-xs text-slate-600 mt-4">
              Each change is recorded in the admin audit log as guardrails.updated (best effort). Setting paused to false
              sets the status back to active and clears suspended_until.
            </p>
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
              code={`// HTTP 403 Forbidden (organization paused or auto-suspended)
{
  "error": {
    "code": "org_suspended",
    "message": "This organization is suspended and cannot accept new requests.",
    "reason": "manual_toggle"
  }
}

// HTTP 429 Too Many Requests (burst rate limit)
{
  "detail": {
    "error": {
      "code": "RATE_LIMITED",
      "message": "Rate limit exceeded: 10 requests per second.",
      "hint": "...",
      "retry_after": 1,
      "context": { "limit": 10, "window": "1 second" }
    }
  }
}`}
            />
            <p className="text-xs text-slate-600 mt-4">
              reason is cost_spike when the anomaly worker suspended the organization.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Notes */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h3 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5" /> Notes
          </h3>
          <ul className="space-y-2 text-sm text-emerald-700">
            <li>• <strong>Organization-wide:</strong> paused applies to every project and agent of the organization. To stop one agent, use POST /v1/agents/&#123;agent_id&#125;/pause; requests that carry its X-Oxy-Agent-Id then get 403 agent_suspended.</li>
            <li>• <strong>No automatic lift:</strong> a cost-spike suspension sets suspended_until (COST_SPIKE_SUSPEND_MINUTES, default 60), but the status stays suspended until paused is set to false.</li>
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

