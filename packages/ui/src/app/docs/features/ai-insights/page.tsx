'use client'

/**
 * 🧠 AI INSIGHTS DOCUMENTATION
 * =============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Brain, CheckCircle2, ArrowRight, Copy, AlertTriangle, TrendingUp } from 'lucide-react'
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

export default function AIInsightsDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">AI Insights</h1>
            <p className="text-slate-500">Real-time anomaly detection. Know before problems happen.</p>
          </div>
        </div>
      </motion.div>

      {/* What we detect */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What We Detect</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Cost Spikes', desc: '10x normal spend rate', severity: 'high' },
                { title: 'Unusual Patterns', desc: 'Off-hours activity, new endpoints', severity: 'medium' },
                { title: 'Error Rates', desc: 'Sudden increase in failures', severity: 'high' },
                { title: 'Latency Anomalies', desc: 'Response times 5x baseline', severity: 'medium' },
                { title: 'Token Anomalies', desc: 'Requests using 10x normal tokens', severity: 'medium' },
                { title: 'Model Drift', desc: 'Agent requesting different models', severity: 'low' },
              ].map((item) => (
                <div key={item.title} className="p-3 bg-slate-50 rounded-xl flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    item.severity === 'high' ? 'bg-red-500' : 
                    item.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Get insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Get Insights</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="bash"
              code={`curl http://localhost:8000/v1/intelligence/anomalies \\
  -H "Authorization: Bearer oxy_sk_..."

# Response
{
  "anomalies": [
    {
      "id": "anom_abc123",
      "type": "cost_spike",
      "severity": "high",
      "detected_at": "2024-01-15T14:30:00Z",
      "description": "Spend rate 15x higher than 7-day average",
      "affected_agent": "agent_xyz",
      "current_rate_usd": 45.00,
      "baseline_rate_usd": 3.00,
      "recommended_action": "Review agent activity and consider kill switch"
    }
  ]
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Auto-actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Automatic Actions</h2>
            <p className="text-slate-600 mb-4">
              Configure automatic responses to anomalies:
            </p>
            <CodeBlock 
              language="json"
              code={`{
  "anomaly_rules": [
    {
      "type": "cost_spike",
      "threshold": "10x",
      "action": "alert",
      "channels": ["slack", "email"]
    },
    {
      "type": "cost_spike", 
      "threshold": "100x",
      "action": "suspend_project",
      "auto_resume_after_minutes": 60
    }
  ]
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/guardrails" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Guardrails
          </Link>
          <Link href="/docs/features/response-caching" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Response Caching <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

