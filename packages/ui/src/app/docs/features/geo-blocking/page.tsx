'use client'

/**
 * 🌐 GEO-BLOCKING DOCUMENTATION
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Globe, CheckCircle2, ArrowRight, Copy, AlertTriangle } from 'lucide-react'
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

export default function GeoBlockingDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Geo-blocking</h1>
            <p className="text-slate-500">Block requests from restricted regions</p>
          </div>
        </div>
      </motion.div>

      {/* Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Configuration (deployment-managed)</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="json"
              code={`// Env-based, header/IP best-effort
ENABLE_GEO_BLOCKING=true
GEO_BLOCKED_COUNTRIES=KP,IR,SY,CU
GEO_BLOCKED_REGIONS=""         // optional
GEO_FAIL_OPEN_ON_UNKNOWN=true  // allow+log when country missing
GEO_ENABLE_IP_LOOKUP=false     // opt-in fallback when headers absent
GEO_BLOCK_STATUS_CODE=451      // 451 by default; 403 supported`}
            />
            <p className="text-xs text-slate-600 mt-4">
              IP/header-based signal only. Operators must maintain the list; this is not sanctions or export-compliance advice. VPNs/proxies may bypass detection.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* When blocked */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">When a Request is Blocked</h2>
            <CodeBlock 
              language="json"
              code={`// HTTP 451 (default)
{
  "error": {
    "code": "geo_blocked",
    "message": "Requests from this region are not allowed.",
    "country": "IR",
    "source": "cf_ipcountry",
    "reason": "country_blocked"
  }
}`}
            />
            <p className="text-xs text-slate-600 mt-4">
              Status code defaults to 451. Unknown country → allow + log by default; set GEO_FAIL_OPEN_ON_UNKNOWN=false to block unknown.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/csv-export" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← CSV Export
          </Link>
          <Link href="/docs/features/webhooks" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Webhooks <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

