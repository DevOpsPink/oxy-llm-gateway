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
            <p className="text-slate-500">What the gateway refuses or redacts around tool use</p>
          </div>
        </div>
      </motion.div>

      {/* What can be blocked */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What Can Be Blocked?</h2>
            <p className="text-sm text-slate-600 mb-4">
              On /v1/chat/completions the gateway sees tool definitions and the tool calls a model returns; your
              agent runs them. Through POST /v1/mcp/invoke, Oxy itself calls a tool on a registered MCP server.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { action: 'tools / functions', desc: 'A chat request whose tool definitions (name, description, parameters) contain a secret or card number is refused with 451 DLP_BLOCKED before it reaches the provider.' },
                { action: 'tool_calls arguments', desc: 'Secrets in tool call arguments of a non-streaming chat response are replaced with [REDACTED_<PATTERN>]. The response is not blocked; with an X-Oxy-Session-Id header the call is logged in tool_call_logs.' },
                { action: 'MCP parameters', desc: 'POST /v1/mcp/invoke with a secret in the parameters is refused with 403 when the tool\'s risk_level is high or critical, and logged with was_blocked=true. Low and medium risk tools still run.' },
                { action: 'MCP requires_approval', desc: 'A tool with requires_approval answers 202 and creates an approval request that expires after 1 hour. Approving it does not release the call in this build: invoke keeps answering 202.' },
                { action: 'MCP output', desc: 'Secrets in an MCP tool\'s output are redacted before the result is returned (metadata.was_redacted).' },
                { action: 'paused agent', desc: 'Chat requests for an agent paused with POST /v1/agents/{agent_id}/pause get 403 agent_suspended (agent_disabled for a disabled agent).' },
                { action: 'killed session', desc: 'Chat requests with the X-Oxy-Session-Id of a killed session get 410 session_terminated.' },
                { action: 'stored, not enforced', desc: 'The agent\'s allowed_tools and a tool\'s allowed_roles, allowed_agents and max_calls_per_minute are saved but not checked in this build.' },
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
        <h2 className="text-xl font-bold text-slate-900 mb-4">Block Rules</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">
              There is no rule API for file, shell, HTTP or database actions. The chat-path secret scan always
              blocks. For MCP tools, risk_level and requires_approval are set per server (copied to each of its
              tools at registration) or per tool. Both endpoints take a user JWT.
            </p>
            <CodeBlock
              language="json"
              code={`// POST /v1/mcp/servers
{
  "name": "Ops tools",
  "description": "Deployment and maintenance tools",
  "server_url": "http://localhost:3001",
  "risk_level": "high",          // low | medium | high | critical (default low)
  "requires_approval": false
}

// POST /v1/mcp/tools/{tool_id}/permissions
{
  "tool_id": "<tool uuid>",
  "requires_approval": true
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
              code={`// POST /v1/chat/completions, secret in tool definitions
// HTTP 451 Unavailable For Legal Reasons
{
  "error": {
    "code": "DLP_BLOCKED",
    "message": "Request blocked: Sensitive data detected (<threat_type>).",
    "hint": "Remove <threat_type> from your message content. ..."
  }
}

// POST /v1/mcp/invoke, secret in parameters of a high/critical tool
// HTTP 403 Forbidden
{
  "detail": "Sensitive data detected in tool parameters: aws_key"
}

// POST /v1/mcp/invoke, tool with requires_approval
// HTTP 202 Accepted
{
  "detail": {
    "status": "approval_required",
    "approval_id": "<uuid>",
    "tool_name": "deploy",
    "message": "This tool requires human approval. Request has been submitted.",
    "hint": "...",
    "retry_after": 30
  }
}`}
            />
            <p className="text-xs text-slate-600 mt-4">
              A blocked chat request is recorded in the request log with status blocked. When the secret is only in
              the tool definitions, threat_type in the message currently reads none. A repeat call within 30 minutes
              while a request is still pending answers 202 with status pending_approval.
            </p>
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

