'use client'

/**
 * CSV EXPORT DOCUMENTATION
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FileDown, CheckCircle2, ArrowRight, Copy, Database } from 'lucide-react'
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

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
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

export default function CSVExportDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-slate-500 to-gray-600 flex items-center justify-center">
            <FileDown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">CSV Export</h1>
            <p className="text-slate-500">Download your organization&apos;s request logs as CSV.</p>
          </div>
        </div>
      </motion.div>

      {/* Export usage */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Export Request Logs</h2>
            <p className="text-slate-600 mb-4">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">GET /v1/exports/requests.csv</code> takes an
              Oxy API key or the dashboard&apos;s signed-in session (then the user&apos;s first active organization) and
              returns rows of the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">request_logs</code> table
              for that organization, newest first. It is the only CSV export.
            </p>
            <CodeBlock 
              language="bash"
              code={`curl "http://localhost:8000/v1/exports/requests.csv?from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z" \\
  -H "Authorization: Bearer oxy_live_..." \\
  -o requests.csv`}
            />
            <ul className="text-sm text-slate-600 mt-4 space-y-1 list-disc pl-5">
              <li>
                <code>from</code>, <code>to</code>: ISO 8601 timestamps. <code>to</code> defaults to now and
                <code> from</code> to 30 days before <code>to</code>; a value that does not parse counts as missing.
              </li>
              <li><code>model</code>, <code>provider</code>, <code>status</code>: optional exact-match filters.</li>
              <li>
                <code>limit</code>: rows to return, 1 to 50,000, default 10,000. A value outside that range gets a 422.
              </li>
              <li>A missing or invalid key or session gets a 401; a failed database read gets a 500.</li>
            </ul>
            <p className="text-sm text-slate-500 mt-4">
              <strong>Columns:</strong> id, created_at, provider, model, status, latency_ms, prompt_tokens,
              completion_tokens, total_tokens, cost_usd, project_id. The file is named
              <code> oxy-requests-YYYY-MM-DD.csv</code> after the export date.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Retention */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
          <Database className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-violet-800 mb-1">Retention</h3>
            <p className="text-sm text-violet-700">
              The export returns whatever rows are still stored. Each organization has a
              <code> request_log_retention_days</code> value (7 to 2555, default 365), read and set through
              <code> GET</code>/<code>POST /v1/privacy</code>. Rows past the window are deleted only when the operator runs
              the <code>fn_enforce_request_log_retention()</code> database function or the
              <code> workers/log_retention.py</code> job; the repository does not schedule either.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/key-rotation" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Key Rotation
          </Link>
          <Link href="/docs/features/geo-blocking" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Geo-blocking <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

