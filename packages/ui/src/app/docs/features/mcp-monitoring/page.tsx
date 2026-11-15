'use client'

/**
 * 🔧 MCP MONITORING DOCUMENTATION
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Cpu, CheckCircle2, ArrowRight, Copy, Eye } from 'lucide-react'
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
            <p className="text-slate-500">See what tools your AI agents are using</p>
          </div>
        </div>
      </motion.div>

      {/* What is MCP */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What is MCP?</h2>
            <p className="text-slate-600 mb-4">
              Model Context Protocol (MCP) gives AI agents "hands" — the ability to call external 
              tools like file systems, databases, and APIs. Oxy monitors all MCP tool invocations.
            </p>
            <ul className="space-y-2">
              {[
                'See every tool your agent calls',
                'Block dangerous tool invocations',
                'Set rate limits per tool',
                'Audit trail for compliance'
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>
      </motion.div>

      {/* Register MCP server */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Register MCP Server</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/v1/mcp/servers \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -d '{
    "name": "filesystem",
    "url": "http://localhost:3001/mcp",
    "tools": ["read_file", "write_file", "list_directory"],
    "allowed_paths": ["/home/user/projects/*"]
  }'`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* View tool calls */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">View Tool Calls</h2>
            <CodeBlock 
              language="json"
              code={`// GET /v1/mcp/invocations
{
  "invocations": [
    {
      "id": "inv_abc123",
      "tool": "read_file",
      "server": "filesystem",
      "agent_id": "agent_xyz",
      "arguments": {"path": "/home/user/config.json"},
      "result": "success",
      "duration_ms": 12,
      "created_at": "2024-01-15T14:30:00Z"
    }
  ]
}`}
            />
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

