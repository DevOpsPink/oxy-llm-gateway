'use client'

/**
 * COST ATTRIBUTION DOCUMENTATION
 * ==================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Tags, Users, Building2, CheckCircle2, 
  ArrowRight, Copy, BarChart3, FileDown
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

function CodeBlock({ code, language = 'python' }: { code: string; language?: string }) {
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

export default function CostAttributionDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Tags className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cost Attribution</h1>
            <p className="text-slate-500">Sum request costs by tag, such as a customer, team or feature.</p>
          </div>
        </div>
      </motion.div>

      {/* Use Cases */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Building2, title: 'By Customer', desc: 'Spend per customer tag', example: 'customer_id:acme_corp' },
            { icon: Users, title: 'By Team', desc: 'Spend per team tag', example: 'team:engineering' },
            { icon: BarChart3, title: 'By Feature', desc: 'Spend per feature tag', example: 'feature:chat_support' },
          ].map((item) => (
            <GlassCard key={item.title}>
              <div className="p-5">
                <item.icon className="h-8 w-8 text-violet-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600 mb-2">{item.desc}</p>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded text-violet-600">{item.example}</code>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* How tags are stored */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">How Tags Are Stored</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              A tag is a row in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">cost_attribution_tags</code> (a
              key matching <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">^[a-z0-9_]+$</code> and a value of up
              to 255 characters, unique per organization). A row in
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> request_attribution</code> links one logged
              request to one tag and carries that request&apos;s cost and tokens.
            </p>
            <p className="text-slate-600 mb-4">
              The gateway has no request header or endpoint for tags and does not write either table: it only stores
              ids such as the project id (on some paths also the agent id) in each request&apos;s
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> request_logs.cost_tags</code>. Until you insert
              rows yourself, for example from a job that reads <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">request_logs</code>,
              the summary below is empty.
            </p>
            <CodeBlock 
              language="sql"
              code={`-- One tag per key/value pair in an organization
INSERT INTO cost_attribution_tags (organization_id, key, value, tag_type, description)
VALUES ('<org_id>', 'customer_id', 'acme_corp', 'customer', 'Acme Corporation');

-- Link a logged request to that tag
INSERT INTO request_attribution
  (request_log_id, tag_id, organization_id, cost_usd, prompt_tokens, completion_tokens)
SELECT id, '<tag_id>', organization_id, cost_usd, prompt_tokens, completion_tokens
FROM request_logs
WHERE id = '<request_log_id>';`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Get summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Get Cost Summary</h2>
            <p className="text-slate-600 mb-4">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">GET /v1/attribution/summary</code> takes an Oxy
              API key or the dashboard&apos;s signed-in session (the dashboard&apos;s Attribution page uses it) and sums <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">request_attribution</code> rows
              per tag, highest cost first. Query parameters: <code>from</code> and <code>to</code> (ISO 8601; the default
              range is the current month up to now), <code>limit</code> (1 to 100, default 20) and <code>key</code> (tags
              with this key).
            </p>
            <CodeBlock 
              language="bash"
              code={`curl "http://localhost:8000/v1/attribution/summary?key=customer_id" \\
  -H "Authorization: Bearer oxy_live_..."

# Response
{
  "attribution_key": "customer_id",
  "from": "2026-11-01T00:00:00+00:00",
  "to": "2026-11-15T12:00:00+00:00",
  "items": [
    {
      "tag": "customer_id:acme_corp",
      "label": "Acme Corporation",
      "tag_id": "5d0c...",
      "tag_key": "customer_id",
      "tag_value": "acme_corp",
      "tag_type": "customer",
      "total_cost_usd": 84.7231,
      "request_count": 1284,
      "avg_cost_usd": 0.065984,
      "model_breakdown": []
    }
  ]
}`}
            />
            <p className="text-sm text-slate-500 mt-3">
              <code>model_breakdown</code> is always an empty list. Without <code>key</code>,
              <code> attribution_key</code> is <code>&quot;cost_tag&quot;</code>. If no tag has the given key, the filter
              is dropped and all tags are summed. <code>limit</code> is applied in the database before the sort, so with
              more tags than <code>limit</code> the list is not guaranteed to be the top spenders.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Export CSV */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileDown className="h-6 w-6 text-violet-600" />
              <h2 className="text-xl font-bold text-slate-900">Export to CSV</h2>
            </div>
            <p className="text-slate-600 mb-4">
              The CSV export returns <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">request_logs</code> rows,
              not tag totals:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl "http://localhost:8000/v1/exports/requests.csv?from=2026-11-01T00:00:00Z" \\
  -H "Authorization: Bearer oxy_live_..." \\
  -o requests.csv`}
            />
            <p className="text-sm text-slate-500 mt-3">
              Columns: id, created_at, provider, model, status, latency_ms, prompt_tokens, completion_tokens,
              total_tokens, cost_usd, project_id. There is no tag column; see{' '}
              <Link href="/docs/features/csv-export" className="underline">CSV Export</Link>.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/cost-optimizer" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← AI Cost Optimizer
          </Link>
          <Link href="/docs/features/budgets" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Budgets & Alerts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
