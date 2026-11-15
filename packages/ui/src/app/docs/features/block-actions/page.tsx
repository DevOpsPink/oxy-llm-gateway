'use client'

/**
 * 🚫 BLOCK ACTIONS DOCUMENTATION
 * ===============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, CheckCircle2, ArrowRight, Copy, AlertTriangle } from 'lucide-react'
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

export default function BlockActionsDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Block Actions</h1>
            <p className="text-slate-500">Prevent dangerous tool calls before they execute</p>
          </div>
        </div>
      </motion.div>

      {/* What can be blocked */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What Can Be Blocked?</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { action: 'file_delete', desc: 'Block file system deletions' },
                { action: 'http_post', desc: 'Block outbound POST/PUT requests' },
                { action: 'shell_exec', desc: 'Block shell command execution' },
                { action: 'db_write', desc: 'Block database write operations' },
                { action: 'email_send', desc: 'Block email sending' },
                { action: 'api_key_create', desc: 'Block API key creation' },
              ].map((item) => (
                <div key={item.action} className="p-3 bg-slate-50 rounded-xl">
                  <code className="text-sm text-rose-600">{item.action}</code>
                  <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Configure rules */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Configure Block Rules</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="json"
              code={`// POST /management/agents/{agent_id}/rules
{
  "rules": [
    {
      "action": "file_delete",
      "decision": "block",
      "paths": ["/etc/*", "/home/*/.ssh/*"]
    },
    {
      "action": "http_post",
      "decision": "block",
      "domains": ["*.evil.com", "pastebin.com"]
    },
    {
      "action": "shell_exec",
      "decision": "require_approval",
      "commands": ["rm", "mv", "chmod"]
    }
  ]
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Response when blocked */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">When an Action is Blocked</h2>
            <CodeBlock 
              language="json"
              code={`// HTTP 403 Forbidden
{
  "error": {
    "code": "ACTION_BLOCKED",
    "message": "This action is not allowed",
    "blocked_action": "file_delete",
    "target": "/etc/passwd",
    "rule_id": "rule_abc123",
    "agent_id": "agent_xyz789"
  }
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/dlp-scanning" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← DLP Scanning
          </Link>
          <Link href="/docs/features/guardrails" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Guardrails <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

