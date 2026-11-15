'use client'

/**
 * 🤖 AGENT TEMPLATES DOCUMENTATION
 * =================================
 * 
 * Source: routes/agents.py:49 (agent_type field)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Bot, CheckCircle2, ArrowRight, Copy, 
  Code2, MessageSquare, Server, Shield, BarChart3,
  FileText, Search, Workflow, Sparkles
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

const agentTemplates = [
  {
    type: 'code_review',
    name: 'Code Review',
    icon: Code2,
    color: 'from-blue-500 to-indigo-600',
    desc: 'Review PRs, find bugs, suggest improvements',
    models: ['gpt-4', 'claude-3-opus'],
    tokenLimit: 8192,
    budgetDefault: 50,
    tools: ['github_api', 'file_read']
  },
  {
    type: 'support',
    name: 'Customer Support',
    icon: MessageSquare,
    color: 'from-emerald-500 to-teal-600',
    desc: 'Answer questions, resolve tickets, escalate issues',
    models: ['gpt-3.5-turbo', 'claude-3-haiku'],
    tokenLimit: 4096,
    budgetDefault: 100,
    tools: ['zendesk_api', 'knowledge_base']
  },
  {
    type: 'devops',
    name: 'DevOps',
    icon: Server,
    color: 'from-orange-500 to-red-600',
    desc: 'Deploy, monitor, fix infrastructure issues',
    models: ['gpt-4', 'claude-3-sonnet'],
    tokenLimit: 4096,
    budgetDefault: 75,
    tools: ['shell_exec', 'kubernetes_api', 'aws_api']
  },
  {
    type: 'security',
    name: 'Security',
    icon: Shield,
    color: 'from-rose-500 to-pink-600',
    desc: 'Scan for vulnerabilities, analyze threats',
    models: ['gpt-4', 'claude-3-opus'],
    tokenLimit: 8192,
    budgetDefault: 100,
    tools: ['file_read', 'http_get']
  },
  {
    type: 'data_analysis',
    name: 'Data Analysis',
    icon: BarChart3,
    color: 'from-violet-500 to-purple-600',
    desc: 'Query databases, generate reports, visualize data',
    models: ['gpt-4-turbo', 'claude-3-sonnet'],
    tokenLimit: 16384,
    budgetDefault: 150,
    tools: ['sql_query', 'python_exec']
  },
  {
    type: 'content',
    name: 'Content',
    icon: FileText,
    color: 'from-amber-500 to-orange-600',
    desc: 'Write articles, social posts, marketing copy',
    models: ['gpt-4', 'claude-3-opus'],
    tokenLimit: 8192,
    budgetDefault: 50,
    tools: ['web_search', 'image_gen']
  },
  {
    type: 'research',
    name: 'Research',
    icon: Search,
    color: 'from-cyan-500 to-blue-600',
    desc: 'Search web, summarize papers, compile findings',
    models: ['gpt-4-turbo', 'claude-3-sonnet'],
    tokenLimit: 32768,
    budgetDefault: 200,
    tools: ['web_search', 'pdf_read', 'arxiv_api']
  },
  {
    type: 'automation',
    name: 'Automation',
    icon: Workflow,
    color: 'from-slate-500 to-slate-700',
    desc: 'Automate workflows, schedule tasks, integrate APIs',
    models: ['gpt-3.5-turbo', 'claude-3-haiku'],
    tokenLimit: 4096,
    budgetDefault: 75,
    tools: ['http_post', 'zapier_api', 'slack_api']
  },
  {
    type: 'custom',
    name: 'Custom',
    icon: Sparkles,
    color: 'from-fuchsia-500 to-pink-600',
    desc: 'Build your own with custom settings',
    models: ['any'],
    tokenLimit: 'custom',
    budgetDefault: 'custom',
    tools: ['custom']
  }
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
            <p className="text-slate-500">9 pre-configured agent types. Or build your own.</p>
          </div>
        </div>
      </motion.div>

      {/* What's included */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What Each Template Includes</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Model Allowlist', desc: 'Recommended models for the use case' },
                { label: 'Token Limits', desc: 'Max tokens per request, optimized for task' },
                { label: 'Budget Defaults', desc: 'Sensible spending limits' },
                { label: 'Tool Permissions', desc: 'Which APIs and actions are allowed' },
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

      {/* Template Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Available Templates</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentTemplates.map((template) => (
            <GlassCard key={template.type}>
              <div className="p-5">
                <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${template.color} flex items-center justify-center mb-3`}>
                  <template.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{template.name}</h3>
                <p className="text-sm text-slate-600 mb-3">{template.desc}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Models:</span>
                    <span className="text-slate-700">{Array.isArray(template.models) ? template.models.slice(0, 2).join(', ') : template.models}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Token Limit:</span>
                    <span className="text-slate-700">{typeof template.tokenLimit === 'number' ? template.tokenLimit.toLocaleString() : template.tokenLimit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Budget:</span>
                    <span className="text-slate-700">{typeof template.budgetDefault === 'number' ? `$${template.budgetDefault}/mo` : template.budgetDefault}</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* How to create */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Create an Agent from Template</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="python"
              code={`from oxy import OxyClient

client = OxyClient(api_key="oxy_sk_...")

# Create agent from template
agent = client.agents.create(
    name="Support Bot",
    agent_type="support",           # ← Template type
    description="Customer support for Acme Corp",
    
    # Override template defaults (optional)
    default_model="gpt-4-turbo",
    max_tokens_per_request=8192,
    budget_limit=200.00,
    
    # Custom tool permissions
    allowed_tools=["zendesk_api", "knowledge_base", "slack_notify"]
)

print(f"Agent created: {agent.id}")  # agent_abc123`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* API Reference */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">API Reference</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="bash"
              code={`# Create agent via REST API
curl -X POST http://localhost:8000/v1/agents \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Code Reviewer",
    "agent_type": "code_review",
    "description": "Reviews PRs in our monorepo",
    "default_model": "gpt-4",
    "budget_limit": 100.00,
    "allowed_models": ["gpt-4", "gpt-4-turbo", "claude-3-opus"]
  }'

# Response
{
  "id": "agent_abc123",
  "name": "Code Reviewer",
  "agent_type": "code_review",
  "status": "active",
  "budget_limit": 100.00,
  "current_spend": 0.00,
  "created_at": "2025-01-15T10:00:00Z"
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Valid agent types */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Valid Agent Types</h2>
            <div className="flex flex-wrap gap-2">
              {['custom', 'code_review', 'support', 'devops', 'security', 'data_analysis', 'content', 'research', 'automation'].map((type) => (
                <code key={type} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                  {type}
                </code>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Best practices */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <h3 className="font-semibold text-violet-800 mb-2">💡 Best Practices</h3>
          <ul className="space-y-2 text-sm text-violet-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Start with templates</strong> — they have production-tested settings</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Set budget limits</strong> — every agent should have a spending cap</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Use model allowlists</strong> — don't let agents switch to expensive models</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Limit tools</strong> — principle of least privilege for tool access</span>
            </li>
          </ul>
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

