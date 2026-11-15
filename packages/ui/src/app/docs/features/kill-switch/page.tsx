'use client'

/**
 * 🛡️ KILL SWITCH DOCUMENTATION
 * ============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Shield, Zap, Clock, AlertTriangle, CheckCircle2, 
  ArrowRight, Copy, Terminal, Code2
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

export default function KillSwitchDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Kill Switch</h1>
            <p className="text-slate-500">Stop any AI agent in under 5 milliseconds</p>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Zap, label: 'Latency', value: 'Fast response', color: 'text-amber-600' },
            { icon: Clock, label: 'Availability', value: 'High availability', color: 'text-emerald-600' },
            { icon: Shield, label: 'Fail Mode', value: 'Fail-open', color: 'text-violet-600' },
          ].map((stat) => (
            <GlassCard key={stat.label}>
              <div className="p-4 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* What it does */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What is Kill Switch?</h2>
            <p className="text-slate-600 mb-4">
              Kill Switch is an emergency stop mechanism that instantly terminates any AI agent session. 
              When triggered, it:
            </p>
            <ul className="space-y-3">
              {[
                'Publishes a Redis signal in <1ms',
                'Blocks all in-flight requests for that agent',
                'Returns 410 Gone status to the client',
                'Logs the kill event for audit trail',
                'Keeps other agents running normally'
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>
      </motion.div>

      {/* How to use */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">How to Use</h2>
        
        {/* Dashboard */}
        <GlassCard className="mb-4">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">Easiest</div>
              <h3 className="font-semibold text-slate-900">Via Dashboard</h3>
            </div>
            <p className="text-slate-600 mb-4">
              Go to <strong>Dashboard → Agents</strong>, find the agent you want to stop, and click the red 
              <strong> Kill </strong> button. The agent will stop immediately.
            </p>
            <div className="bg-slate-100 rounded-xl p-4 text-center text-slate-500">
              [Dashboard screenshot placeholder]
            </div>
          </div>
        </GlassCard>

        {/* API */}
        <GlassCard className="mb-4">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded">API</div>
              <h3 className="font-semibold text-slate-900">Via API</h3>
            </div>
            <p className="text-slate-600 mb-4">
              Use the REST API to programmatically kill sessions:
            </p>
            <CodeBlock 
              language="bash"
              code={`# Kill a specific session
curl -X DELETE \\
  http://localhost:8000/v1/agents/{agent_id}/sessions/{session_id} \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "Detected unauthorized file access"}'`}
            />
            <div className="mt-4">
              <CodeBlock 
                language="python"
                code={`# Python SDK
from oxy import OxyClient

client = OxyClient(api_key="oxy_sk_...")

# Kill a specific session
client.agents.kill_session(
    agent_id="agent_abc123",
    session_id="sess_xyz789",
    reason="Budget exceeded"
)

# Kill ALL sessions for an agent (emergency)
client.agents.kill_all_sessions(
    agent_id="agent_abc123",
    reason="Security incident"
)`}
              />
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Response */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">API Response</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="json"
              code={`{
  "success": true,
  "killed": true,
  "session_id": "sess_xyz789",
  "reason": "Budget exceeded",
  "latency": {
    "kill_signal_ms": 0.8,
    "total_ms": 4.2,
    "guarantee": "low-latency kill signal (best-effort, no formal SLA)"
  }
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Warning */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Fail-Open Design</h3>
            <p className="text-sm text-amber-700">
              If Oxy becomes unreachable, your requests bypass our proxy and go directly to your AI provider. 
              Your production never stops because of us. The kill switch only works when Oxy is reachable.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Next */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs" className="text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-1">
            ← Back to Docs
          </Link>
          <Link href="/docs/features/dlp-scanning" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: DLP Scanning <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

