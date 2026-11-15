'use client'

/**
 * WEBHOOKS DOCUMENTATION
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Webhook, CheckCircle2, ArrowRight, Copy, AlertTriangle } from 'lucide-react'
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
            <p className="text-slate-500">Best-effort alerts to Slack, Discord and Zapier, plus a webhook registry</p>
          </div>
        </div>
      </motion.div>

      {/* Event types */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Event Types</h2>
            <p className="text-slate-600 mb-4">
              The API accepts exactly these three names; any other is rejected.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { event: 'budget.threshold_crossed', desc: 'A project reached 80%, 95% or 100% of its budget. Checked when the proxy reserves budget for a request; sent at most once per threshold and project per 24 hours.' },
                { event: 'anomaly.raised', desc: 'Sent by the cost anomaly worker (workers/cost_anomaly_detector.py) when it flags a project\'s hourly spend.' },
                { event: 'request.created', desc: 'Accepted in settings and registrations, but nothing in the engine sends it.' },
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

      {/* Configure delivery */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Configure Delivery</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Alerts go to the URLs in your notification settings. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">GET</code> and
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> POST /v1/notifications/settings</code> take an Oxy API key or
              the dashboard&apos;s signed-in session; changing the settings, and creating or deleting a webhook, needs an
              owner or admin of the organization (403 otherwise). Each URL must start with its service&apos;s prefix
              (<code>https://hooks.slack.com/</code>, <code>https://discord.com/api/webhooks/</code> or
              <code> https://discordapp.com/api/webhooks/</code>, <code>https://hooks.zapier.com/</code>) when that channel
              is enabled, or the call gets a 400.
            </p>
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/v1/notifications/settings \\
  -H "Authorization: Bearer oxy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "slack_webhook_url": "https://hooks.slack.com/services/...",
    "slack_enabled": true,
    "zapier_webhook_url": "https://hooks.zapier.com/hooks/catch/...",
    "zapier_enabled": true,
    "zapier_events": ["budget.threshold_crossed"]
  }'`}
            />
            <p className="text-sm text-slate-500 mt-4">
              The body is the whole settings row: fields you leave out take their defaults. Slack gets
              <code> {'{"text": ...}'}</code> and Discord <code>{'{"content": ...}'}</code> for budget alerts and cost
              anomalies. Zapier gets only the events in <code>zapier_events</code>; an empty list means
              <code> budget.threshold_crossed</code> and <code>anomaly.raised</code>.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Payload example */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Zapier Payload</h2>
            <CodeBlock 
              language="json"
              code={`{
  "event_type": "budget.threshold_crossed",
  "organization_id": "9b1f...",
  "timestamp": "2026-11-15T14:30:00.512345+00:00",
  "project_id": "c2a4...",
  "project_name": "Support bot",
  "threshold": 80,
  "current_spend": 80.5,
  "budget_limit": 100.0,
  "percentage": 80.5
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              Fields are flat, not nested. Requests are not signed. Each delivery is one POST with a 5-second timeout and
              one retry after a network error or a 5xx; a failure is logged and dropped.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Registry */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Webhook Registry</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">POST /v1/webhooks</code> stores a URL
              (<code>http://</code> or <code>https://</code>) with a non-empty <code>event_types</code> list.
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> GET /v1/webhooks</code> lists active ones and
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> DELETE /v1/webhooks/{'{id}'}</code> disables one,
              with the same auth as the settings. The server generates a secret and stores it, but never returns it.
            </p>
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/v1/webhooks \\
  -H "Authorization: Bearer oxy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.example/webhooks/oxy",
    "event_types": ["budget.threshold_crossed", "anomaly.raised"]
  }'`}
            />
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                No engine code sends events to URLs registered here. Deliveries go only to the Slack, Discord and Zapier
                URLs in notification settings.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
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
