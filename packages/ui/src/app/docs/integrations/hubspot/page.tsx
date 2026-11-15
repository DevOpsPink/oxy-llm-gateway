'use client'

/**
 * 🔗 HUBSPOT INTEGRATION DOCUMENTATION
 * =====================================
 *
 * Source: integrations/hubspot.py (no engine code imports it)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Link2, CheckCircle2, ArrowRight, Copy,
  Users, FileText, Bell, RefreshCw, AlertTriangle
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

export default function HubSpotDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Link2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">HubSpot Integration</h1>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">Not wired</span>
            </div>
            <p className="text-slate-500">A HubSpot CRM client module ships with the engine. Nothing calls it.</p>
          </div>
        </div>
      </motion.div>

      {/* Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Current status</h3>
            <p className="text-sm text-amber-700">
              <code>integrations/hubspot.py</code> is not imported anywhere in the engine (only its tests use it), so a
              running Oxy sends nothing to HubSpot, whatever the environment says. There is no dashboard setting for it.
            </p>
          </div>
        </div>
      </motion.div>

      {/* What the module contains */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What the Module Contains</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: RefreshCw, title: 'HubSpotClient', desc: 'Creates and updates contacts, deals and notes through the HubSpot CRM v3 API' },
                { icon: Users, title: 'sync_user_to_hubspot', desc: 'Looks up a contact by email and creates it if missing' },
                { icon: FileText, title: 'track_subscription_in_hubspot', desc: 'Creates a deal on the contact and adds a note' },
                { icon: Bell, title: 'track_churn_in_hubspot', desc: 'Adds a cancellation note to the contact' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900"><code>{item.title}</code></div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                    <div className="text-xs text-slate-500 mt-1">Called by: nothing in the engine</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Settings the Module Reads</h2>
        <GlassCard>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              These only matter if you call the module from your own code.
            </p>
            <CodeBlock
              language="bash"
              code={`HUBSPOT_ENABLED=false        # every call is a no-op unless 1, true, yes or on
HUBSPOT_API_KEY=             # sent as a Bearer token; the helper functions do nothing when it is empty
HUBSPOT_MAX_RETRIES=3        # default; attempts are capped at 2 regardless
HUBSPOT_BACKOFF_SECONDS=0.5  # default; wait before a retry, times the attempt number`}
            />
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Each HTTP call has a 5-second timeout.</li>
              <li>• 5xx responses, timeouts and connection errors are retried once; 401 and 403 are not retried.</li>
              <li>• A failed HTTP call returns an empty result instead of raising.</li>
            </ul>
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/mcp-monitoring" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← MCP Monitoring
          </Link>
          <Link href="/docs/features/team-management" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Team Management <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
