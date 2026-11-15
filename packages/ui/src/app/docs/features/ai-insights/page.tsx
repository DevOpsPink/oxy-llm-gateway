'use client'

/**
 * AI INSIGHTS DOCUMENTATION
 * =============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Brain, CheckCircle2, ArrowRight, Copy, AlertTriangle } from 'lucide-react'
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
            <p className="text-slate-500">Rule-based anomaly flags, cost totals, a spend projection and a security score. Advisory only.</p>
          </div>
        </div>
      </motion.div>

      {/* What we detect */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Anomaly Rules</h2>
            <p className="text-slate-600 mb-4">
              The anomalies the API returns are rows of the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">anomaly_alerts</code> table.
              The rules that write them live in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">workers/anomaly_detector.py</code> and
              compare the last hour with a baseline. The dot shows the highest severity a rule can raise.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Cost Spike', desc: 'Last-hour spend above 3x the 7-day hourly average', severity: 'high' },
                { title: 'Volume Spike', desc: 'Last-hour requests above 5x the 7-day hourly average', severity: 'high' },
                { title: 'Budget Burn', desc: 'A project on pace to use up its budget within 24 hours', severity: 'critical' },
                { title: 'DLP Rate', desc: 'Over 5% of last-hour requests flagged by DLP', severity: 'critical' },
                { title: 'Session Burst', desc: 'More than 10 new agent sessions per minute over 5 minutes', severity: 'high' },
              ].map((item) => (
                <div key={item.title} className="p-3 bg-slate-50 rounded-xl flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    item.severity === 'critical' ? 'bg-red-500' : 
                    item.severity === 'high' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                No service in <code>docker-compose.yml</code> runs these rules on a schedule, so the anomaly list stays
                empty unless something writes <code>anomaly_alerts</code> rows. The compose stack&apos;s
                <code> worker-cost-anomaly</code> and <code>worker-anomaly</code> services run separate checks that do not
                write to this table.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Get insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Get Insights</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">GET /v1/intelligence/overview</code> takes an Oxy
              API key or the dashboard&apos;s signed-in session. It returns the 10 newest anomaly rows, up to 5 models and 5 projects with their cost this month,
              the month-to-date cost with a straight-line projection to month end, and the security score. It only reads.
            </p>
            <CodeBlock 
              language="bash"
              code={`curl http://localhost:8000/v1/intelligence/overview \\
  -H "Authorization: Bearer oxy_live_..."

# Response
{
  "anomalies": [
    {
      "id": "8f1e...",
      "type": "budget_burn",
      "severity": "critical",
      "detected_at": "2026-11-15T14:30:00+00:00",
      "description": "Project 'Support bot' will exhaust budget in 5.2 hours",
      "project_id": "c2a4...",
      "model": null,
      "estimated_impact_usd": null
    }
  ],
  "cost_insights": {
    "top_models": [{ "model": "gpt-4.1-mini", "requests": 5120, "cost_usd": 61.2 }],
    "top_projects": [{ "project_id": "c2a4...", "name": "Support bot", "cost_usd": 61.2, "requests": 5120 }],
    "month_to_date_cost_usd": 61.2
  },
  "forecast": {
    "month_to_date_cost_usd": 61.2,
    "projected_end_of_month_cost_usd": 122.4
  },
  "security_score": {
    "score": 88,
    "grade": "B",
    "details": [{ "key": "budgets", "label": "Budgets configured", "status": "ok", "points": 10 }],
    "note": "Heuristic only; not a security certification.",
    "last_calculated": "2026-11-15T14:31:02+00:00"
  }
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              The other routes under <code>/v1/intelligence</code> (<code>/anomalies</code>, <code>/anomalies/detect</code>,
              <code> /anomalies/{'{id}'}</code>, <code>/cost-insights</code>, <code>/spend-forecast</code>,
              <code> /security-score</code>) declare their
              <code> request</code> argument without a type, so FastAPI reads it as a required query parameter: a normal
              call gets a 422.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Security score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Security Score</h2>
            <p className="text-slate-600 mb-4">
              A fixed table applied to your settings, starting at 100 and clamped to 0 to 100. It is a checklist, not an
              assessment:
            </p>
            <CodeBlock 
              language="json"
              code={`{
  "budgets":          "+10 if any project has a budget, -20 if none",
  "dlp":              "+5 if DLP is enabled, -25 if not",
  "privacy_mode":     "zero_prompt_logging +10, metadata_only +5, debug_full -15, other -10",
  "key_rotation":     "oldest key <= 90 days +5, 91-180 days -5, older -15, unknown -10",
  "rate_limits":      "+5 if a per-minute limit is set, -20 if not",
  "response_caching": "+3 if enabled, -5 if not",
  "grades":           "A >= 90, B >= 80, C >= 65, D >= 50, else F"
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
