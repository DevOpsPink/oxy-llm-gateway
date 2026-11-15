'use client'

/**
 * 🏷️ COST ATTRIBUTION DOCUMENTATION
 * ==================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Tags, DollarSign, Users, Building2, CheckCircle2, 
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
            <p className="text-slate-500">Tag costs by customer, team, or feature. Bill them back.</p>
          </div>
        </div>
      </motion.div>

      {/* Use Cases */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Building2, title: 'By Customer', desc: 'Bill AI costs to specific customers', example: 'customer_id: acme_corp' },
            { icon: Users, title: 'By Team', desc: 'Track spend per department', example: 'team: engineering' },
            { icon: BarChart3, title: 'By Feature', desc: 'Know which features cost most', example: 'feature: chat_support' },
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

      {/* How to tag */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">How to Tag Requests</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Add tags to any request using the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">X-Oxy-Tags</code> header:
            </p>
            <CodeBlock 
              language="python"
              code={`# Tag a request with customer and feature
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Help me with..."}],
    extra_headers={
        "X-Oxy-Tags": "customer_id=acme_corp,feature=support_bot,team=cs"
    }
)

# Multiple tags are comma-separated
# Format: key=value,key=value,...`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Create tags via API */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create Tags via API</h2>
            <p className="text-slate-600 mb-4">
              Pre-create tags for better organization and validation:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/management/attribution/tags \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "customer_id",
    "value": "acme_corp",
    "description": "Acme Corporation - Enterprise Plan",
    "tag_type": "customer",
    "is_billable": true
  }'`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Get summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Get Cost Summary</h2>
            <p className="text-slate-600 mb-4">
              Retrieve aggregated costs by tag:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl http://localhost:8000/management/attribution/summary \\
  -H "Authorization: Bearer oxy_sk_..."

# Response
{
  "tags": [
    {
      "key": "customer_id",
      "value": "acme_corp",
      "total_requests": 12847,
      "total_cost_usd": 847.23,
      "total_tokens_prompt": 2847293,
      "total_tokens_completion": 982847
    },
    ...
  ],
  "period": "2024-01-01T00:00:00Z / 2024-01-31T23:59:59Z"
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Export CSV */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileDown className="h-6 w-6 text-violet-600" />
              <h2 className="text-xl font-bold text-slate-900">Export to CSV</h2>
            </div>
            <p className="text-slate-600 mb-4">
              Export cost data for finance team or chargeback processing:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl "http://localhost:8000/api/v1/reports/export?start_date=2024-01-01&end_date=2024-01-31" \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -o usage_report.csv`}
            />
            <p className="text-sm text-slate-500 mt-3">
              CSV includes: date, customer_id, feature, team, model, tokens, cost_usd
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Chargeback */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <h3 className="font-semibold text-violet-800 mb-2">Enterprise: Chargeback System</h3>
          <p className="text-sm text-violet-700 mb-3">
            Set up automatic chargeback rules to bill costs to departments or customers:
          </p>
          <CodeBlock 
            language="json"
            code={`// POST /management/chargeback/rules
{
  "name": "Marketing Department AI Costs",
  "tag_key": "team",
  "tag_value": "marketing",
  "chargeback_type": "department",
  "chargeback_target_id": "DEPT-MARKETING",
  "markup_percentage": 15
}`}
          />
          <p className="text-sm text-violet-600 mt-3">
            Tag requests with the <code>X-Oxy-Tags</code> header; see the API reference for the summary and export endpoints.
          </p>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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

