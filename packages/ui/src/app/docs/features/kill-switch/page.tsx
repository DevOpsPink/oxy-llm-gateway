'use client'

/**
 * 🛡️ KILL SWITCH DOCUMENTATION
 * ============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Shield, Zap, Clock, AlertTriangle, CheckCircle2, 
  ArrowRight, Copy
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
            <p className="text-slate-500">End an agent session; Oxy refuses its later requests</p>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Clock, label: 'First refusal after the kill call (measured in CI)', value: '~100–300 ms', color: 'text-amber-600' },
            { icon: Zap, label: 'Scope', value: 'One session', color: 'text-emerald-600' },
            { icon: Shield, label: 'Fail Mode', value: 'Fail-closed', color: 'text-violet-600' },
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
              The kill switch ends one agent session. Requests belong to a session when they carry its id in
              the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">X-Oxy-Session-Id</code> header. When triggered, it:
            </p>
            <ul className="space-y-3">
              {[
                'Marks the session killed in Postgres (agent_sessions, the authority) and sets a Redis flag (the fast path, kept for 1 hour)',
                'Refuses later requests carrying that X-Oxy-Session-Id with 410 session_terminated',
                'Stops a streaming response for that session after its next chunk; a non-streaming call already sent to the provider completes',
                'Records agent_session.killed in the audit log (API call below)',
                'Leaves the agent\'s other sessions running'
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
              Go to <strong>Dashboard → Agents</strong>, select the agent, click the red
              <strong> Kill </strong> button on a running session and confirm. <strong>Kill All Sessions</strong> in
              the agent&apos;s menu kills every pending or running session of that agent.
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
              Kill a session with an Oxy API key of the session&apos;s organization. There is no request body. A session of
              another organization, an unknown id or a session that already ended gets 404:
            </p>
            <CodeBlock 
              language="bash"
              code={`# Kill a specific session
curl -X POST \\
  http://localhost:8000/v1/agent-sessions/{session_id}/kill \\
  -H "Authorization: Bearer oxy_live_..."`}
            />
            <div className="mt-4">
              <p className="text-slate-600 mb-4">
                The agent&apos;s own requests name the session. An agent or session id that is not a UUID gets 400;
                one that belongs to another organization gets 403:
              </p>
              <CodeBlock 
                language="bash"
                code={`curl http://localhost:8000/v1/chat/completions \\
  -H "Authorization: Bearer oxy_live_..." \\
  -H "X-Oxy-Session-Id: {session_id}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4.1-mini", "messages": [{"role": "user", "content": "Hi"}]}'`}
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
              code={`// POST /v1/agent-sessions/{session_id}/kill → 200
{"status": "ok"}

// A later request with that X-Oxy-Session-Id → 410
{
  "error": {
    "code": "session_terminated",
    "message": "Agent session {session_id} has been terminated. Create a new session with POST /v1/agents/{agent_id}/sessions; do not retry with this session_id."
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
            <h3 className="font-semibold text-amber-800 mb-1">Fail-Closed Design</h3>
            <p className="text-sm text-amber-700">
              If neither Redis nor Postgres can say whether a session was killed, the request is refused with
              503 kill_switch_unavailable instead of being served. The kill switch only sees requests that go through
              Oxy and carry the session&apos;s X-Oxy-Session-Id; calls made straight to a provider are out of its reach.
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

