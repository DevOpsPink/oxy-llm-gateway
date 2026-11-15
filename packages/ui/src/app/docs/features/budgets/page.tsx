'use client'

/**
 * 💰 BUDGETS & ALERTS DOCUMENTATION
 * ==================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Bell, DollarSign, Mail, CheckCircle2, 
  ArrowRight, Copy, AlertTriangle, Zap
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

export default function BudgetsDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Budgets & Alerts</h1>
            <p className="text-slate-500">Set limits. Get notified. Help avoid overspending.</p>
          </div>
        </div>
      </motion.div>

      {/* Alert thresholds */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Alert Thresholds</h2>
            <p className="text-slate-600 mb-4">
              Oxy automatically sends alerts at key budget milestones:
            </p>
            
            <div className="space-y-3">
              {[
                { threshold: '80%', color: 'bg-amber-100 text-amber-700', desc: 'Warning — Time to review usage' },
                { threshold: '95%', color: 'bg-orange-100 text-orange-700', desc: 'Critical — Take action now' },
                { threshold: '100%', color: 'bg-red-100 text-red-700', desc: 'Budget exhausted — Requests blocked' },
              ].map((item) => (
                <div key={item.threshold} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold ${item.color}`}>
                    {item.threshold}
                  </span>
                  <span className="text-slate-600">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Set budget */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Set a Budget</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Set a project's budget (a total in USD, 0 for no cap). The call takes a dashboard session token, not an API key:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl -X PUT http://localhost:8000/management/project/{project_id} \\
  -H "Authorization: Bearer $SESSION_TOKEN" \\
  -H "X-CSRF-Token: any-value" -b csrf_token=any-value \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-project", "budget_limit": 500.00}'`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Budget actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What Happens at 100%?</h2>
            <div className="space-y-4">
              {[
                {
                  action: '402',
                  title: 'BUDGET_EXCEEDED',
                  desc: 'A request whose reservation would pass the cap is refused before it reaches the provider, and recorded in request_logs.',
                },
                {
                  action: '503',
                  title: 'budget_unavailable',
                  desc: 'If the budget cannot be checked (Redis down), the request is refused rather than served unchecked, and recorded.',
                },
              ].map((item) => (
                <div key={item.action} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="bg-slate-200 px-2 py-0.5 rounded text-sm">{item.action}</code>
                    <span className="font-semibold text-slate-900">{item.title}</span>
                  </div>
                  <p className="text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Notification channels */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Notification Channels</h2>
            <p className="text-slate-600 mb-4">
              Configure where to receive budget alerts:
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Mail, title: 'Email', desc: 'Sent to the project owner when SMTP is configured.', status: 'Optional' },
                { icon: Bell, title: 'Slack / Discord', desc: 'Best-effort alerts via webhooks you provide.', status: 'Best-effort' },
                { icon: Zap, title: 'Webhook', desc: 'POST to your endpoint.', status: 'Best-effort' },
              ].map((item) => (
                <div key={item.title} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <item.icon className="h-5 w-5 text-violet-600" />
                    <span className="font-medium text-slate-900">{item.title}</span>
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{item.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Anomaly detection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Cost Anomaly Detection</h3>
            <p className="text-sm text-amber-700">
              The cost-anomaly worker also looks for unusual spending (e.g., 10x the usual rate) and alerts.
              With auto-suspend on, a critical spike suspends the organization. Heuristic and best-effort.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/cost-attribution" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Cost Attribution
          </Link>
          <Link href="/docs/features/referral-credits" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Referral Credits <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

