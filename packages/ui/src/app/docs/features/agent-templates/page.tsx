'use client'

/**
 * 🤖 AGENT TEMPLATES DOCUMENTATION
 * =================================
 *
 * Source: routes/agents.py (AgentCreate.agent_type, create_agent, list_agents),
 * db/schema.sql (agents table), routes/agent_templates.py (not mounted in main.py)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bot, CheckCircle2, ArrowRight, Copy,
  Code2, MessageSquare, Server, Shield, BarChart3,
  FileText, Search, Workflow, Sparkles, AlertTriangle
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

const agentTypes = [
  { type: 'custom', name: 'Custom', icon: Sparkles, color: 'from-fuchsia-500 to-pink-600' },
  { type: 'code_review', name: 'Code Review', icon: Code2, color: 'from-blue-500 to-indigo-600' },
  { type: 'support', name: 'Support', icon: MessageSquare, color: 'from-emerald-500 to-teal-600' },
  { type: 'devops', name: 'DevOps', icon: Server, color: 'from-orange-500 to-red-600' },
  { type: 'security', name: 'Security', icon: Shield, color: 'from-rose-500 to-pink-600' },
  { type: 'data_analysis', name: 'Data Analysis', icon: BarChart3, color: 'from-violet-500 to-purple-600' },
  { type: 'content', name: 'Content', icon: FileText, color: 'from-amber-500 to-orange-600' },
  { type: 'research', name: 'Research', icon: Search, color: 'from-cyan-500 to-blue-600' },
  { type: 'automation', name: 'Automation', icon: Workflow, color: 'from-slate-500 to-slate-700' },
]

const agentDefaults = [
  { field: 'default_model', value: '"gpt-4o"' },
  { field: 'allowed_models', value: '["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"]' },
  { field: 'allowed_tools', value: '[]' },
  { field: 'max_tokens_per_request', value: '4096 (1 to 128000)' },
  { field: 'max_requests_per_session', value: '100 (1 to 10000)' },
  { field: 'max_tool_calls_per_session', value: '50 (1 to 1000)' },
  { field: 'budget_limit', value: '0.00 USD (0 = no limit)' },
  { field: 'reset_period', value: '"monthly" (daily, weekly, monthly, never)' },
]

export default function AgentTemplatesDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Agent Templates</h1>
            <p className="text-slate-500">An agent carries an <code>agent_type</code> label with nine allowed values. The label applies no preset.</p>
          </div>
        </div>
      </motion.div>

      {/* What agent_type does */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What agent_type Does</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Validated', desc: 'Must be one of the nine values below; default custom. Anything else is rejected with 422.' },
                { label: 'Stored', desc: 'Saved on the agent row and returned by the agents API.' },
                { label: 'Filterable', desc: 'GET /v1/agents?agent_type=support lists only agents with that label.' },
                { label: 'No presets', desc: 'Models, token limits, budget and tools take the same defaults for every type.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900">{item.label}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Type Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Valid agent_type Values</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentTypes.map((template) => (
            <GlassCard key={template.type}>
              <div className="p-5">
                <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${template.color} flex items-center justify-center mb-3`}>
                  <template.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{template.name}</h3>
                <code className="text-sm text-slate-600">{template.type}</code>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* Defaults */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Defaults for Every Agent</h2>
            <p className="text-sm text-slate-600 mb-4">Used when a field is left out of the create request, whatever the agent_type.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="text-slate-700">
                  {agentDefaults.map((row) => (
                    <tr key={row.field} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4"><code className="bg-slate-100 px-1 rounded">{row.field}</code></td>
                      <td className="py-2"><code className="text-slate-600">{row.value}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* API Reference */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Create an Agent</h2>
        <GlassCard>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              <code className="bg-slate-100 px-1 rounded">/v1/agents</code> takes a dashboard user&apos;s access token (the
              Supabase session JWT), not an <code className="bg-slate-100 px-1 rounded">oxy_live_</code> API key. Only an
              organization owner or admin can create agents.
            </p>
            <CodeBlock
              language="bash"
              code={`curl -X POST http://localhost:8000/v1/agents \\
  -H "Authorization: Bearer <user access token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Code Reviewer",
    "project_id": "<project uuid>",
    "agent_type": "code_review",
    "description": "Reviews PRs in our monorepo",
    "default_model": "gpt-4o",
    "budget_limit": 100.00
  }'

# Response (abbreviated)
{
  "success": true,
  "agent": {
    "id": "<uuid>",
    "name": "Code Reviewer",
    "agent_type": "code_review",
    "status": "active",
    "budget_limit": 100.00,
    "current_spend": 0.00,
    "created_at": "..."
  }
}`}
            />
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• <strong>401</strong>: missing, invalid or expired token</li>
              <li>• <strong>403</strong>: not an owner or admin, or the organization already has as many agents (not disabled) as its plan tier allows: free 3, starter 10, growth 50, business and enterprise 9999. The operator sets the tier in the database.</li>
              <li>• <strong>404</strong>: the project does not belong to your organization</li>
              <li>• <strong>409</strong>: an agent with this name already exists in the organization</li>
            </ul>
          </div>
        </GlassCard>
      </motion.div>

      {/* Template endpoints */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Saved Templates</h2>
            <p className="text-sm text-slate-600">
              <code className="bg-slate-100 px-1 rounded">routes/agent_templates.py</code> defines a{' '}
              <code className="bg-slate-100 px-1 rounded">/v1/agent-templates</code> API, but <code className="bg-slate-100 px-1 rounded">main.py</code> does
              not include that router and <code className="bg-slate-100 px-1 rounded">db/schema.sql</code> has no{' '}
              <code className="bg-slate-100 px-1 rounded">agent_templates</code> table, so those paths return 404.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Enforcement */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Stored, Not Enforced</h3>
            <p className="text-sm text-amber-700">
              <code>allowed_models</code>, <code>allowed_tools</code>, <code>max_tokens_per_request</code>, the per-session
              limits and the per-agent <code>budget_limit</code> are saved and returned, but no request path reads them.
              Spending on <code>/v1/chat/completions</code> is limited by the project&apos;s <code>budget_limit</code>.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/local-models" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Local Models
          </Link>
          <Link href="/docs/features/team-management" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Team Management <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
