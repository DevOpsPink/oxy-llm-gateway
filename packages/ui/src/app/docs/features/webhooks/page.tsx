'use client'

/**
 * 🔔 WEBHOOKS DOCUMENTATION
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Webhook, CheckCircle2, ArrowRight, Copy } from 'lucide-react'
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

export default function WebhooksDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Webhook className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Webhooks</h1>
            <p className="text-slate-500">Real-time notifications to your endpoints</p>
          </div>
        </div>
      </motion.div>

      {/* Event types */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Event Types</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { event: 'budget.threshold', desc: 'Budget 80%/95%/100% reached' },
                { event: 'agent.killed', desc: 'Kill switch triggered' },
                { event: 'threat.detected', desc: 'DLP found sensitive data' },
                { event: 'anomaly.detected', desc: 'Cost or pattern anomaly' },
                { event: 'key.expiring', desc: 'API key nearing expiry' },
                { event: 'project.suspended', desc: 'Project auto-suspended' },
              ].map((item) => (
                <div key={item.event} className="p-3 bg-slate-50 rounded-xl">
                  <code className="text-sm text-violet-600">{item.event}</code>
                  <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Create webhook */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Create a Webhook</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/management/webhooks \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -d '{
    "url": "https://your-app.com/webhooks/oxy",
    "events": ["budget.threshold", "threat.detected"],
    "secret": "whsec_..."
  }'`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Payload example */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Webhook Payload</h2>
            <CodeBlock 
              language="json"
              code={`{
  "id": "evt_abc123",
  "event": "budget.threshold",
  "created_at": "2024-01-15T14:30:00Z",
  "data": {
    "project_id": "proj_xyz",
    "threshold": 80,
    "current_spend": 80.50,
    "budget_limit": 100.00
  }
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              Verify signature using HMAC-SHA256 with your webhook secret.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/geo-blocking" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Geo-blocking
          </Link>
          <Link href="/docs/features/mcp-monitoring" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: MCP Monitoring <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

