'use client'

/**
 * MCP MONITORING DOCUMENTATION
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Cpu, CheckCircle2, ArrowRight, Copy } from 'lucide-react'
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

export default function MCPMonitoringDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">MCP Monitoring</h1>
            <p className="text-slate-500">Register tool servers, call their tools through Oxy, and log each call</p>
          </div>
        </div>
      </motion.div>

      {/* What is MCP */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What is MCP?</h2>
            <p className="text-slate-600 mb-4">
              Model Context Protocol (MCP) servers expose tools such as file systems, databases and APIs to agents. Oxy
              sees only the tool calls that go through <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">POST /v1/mcp/invoke</code>;
              calls an agent makes to a tool server directly never reach it. For those calls Oxy will:
            </p>
            <ul className="space-y-2">
              {[
                'Record each executed or blocked call in the tool_call_logs table',
                'Refuse (403) a call to a high- or critical-risk tool when DLP finds sensitive data in its parameters',
                'Stop calls to tools marked requires_approval with a 202 and an approval request',
                'Redact secrets that DLP finds in the tool output before returning it'
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-500 mt-4">
              Per-tool <code>allowed_roles</code>, <code>allowed_agents</code> and <code>max_calls_per_minute</code> can
              be stored through <code>/v1/mcp/tools/{'{tool_id}'}/permissions</code>, but the invoke route does not check
              them.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Register MCP server */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Register MCP Server</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              The <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/v1/mcp</code> routes take the dashboard&apos;s
              signed-in session token, not an Oxy API key. On registration Oxy fetches
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> {'{server_url}'}/mcp/tools</code> (or
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm"> /.well-known/mcp.json</code> after a 404) and stores
              the <code>tools</code> list it returns; an unreachable server gets a 400.
            </p>
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/v1/mcp/servers \\
  -H "Authorization: Bearer <jwt_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "filesystem",
    "description": "Read and write files in the project folder",
    "server_url": "http://localhost:3001",
    "risk_level": "high",
    "requires_approval": false
  }'

# Response
{
  "success": true,
  "server_id": "3e7a...",
  "server_url": "http://localhost:3001",
  "tools_registered": 3,
  "tools": ["read_file", "write_file", "list_directory"]
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              <code>description</code> is required (10 to 500 characters). <code>risk_level</code> is low, medium, high or
              critical (default low) and is copied to every tool of the server, as is <code>requires_approval</code>.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* View tool calls */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Call a Tool and View Calls</h2>
            <p className="text-slate-600 mb-4">
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">POST /v1/mcp/invoke</code> forwards
              <code> {'{"tool", "parameters"}'}</code> to the server&apos;s <code>/mcp/call</code>; a failed server call returns
              502. A tool that needs approval answers 202 with an <code>approval_id</code>, which a member of the
              organization can approve or reject with <code>POST /v1/mcp/approvals/{'{id}'}</code> within an hour.
              Approving only records the decision: it does not run the call, and calling invoke again opens a new
              approval request, so such a tool cannot run through invoke.
            </p>
            <CodeBlock 
              language="json"
              code={`// POST /v1/mcp/invoke
{
  "tool_name": "read_file",
  "parameters": {"path": "README.md"},
  "agent_session_id": "<session_id>"
}

// Response
{
  "success": true,
  "output": {"content": "..."},
  "metadata": {
    "tool_name": "read_file",
    "tool_id": "b81c...",
    "duration_ms": 12,
    "was_redacted": false,
    "threats_detected": null
  }
}

// GET /v1/agents/{agent_id}/sessions/{session_id}
{
  "session": { "...": "..." },
  "tool_calls": [
    {
      "id": "0f2d...",
      "tool_name": "read_file",
      "status": "success",
      "duration_ms": 12,
      "threat_detected": false,
      "started_at": "2026-11-15T14:30:00+00:00"
    }
  ]
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              The session view lists the 100 newest calls logged with that session id; there is no separate route that
              lists all calls. Tool calls inside non-streaming chat completions are also DLP-scanned: secrets in their
              arguments are redacted, and such a call is logged (status <code>threat_detected</code>) when the request
              carries a session id.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/webhooks" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Webhooks
          </Link>
          <Link href="/docs/features/prompt-library" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Prompt Library <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
