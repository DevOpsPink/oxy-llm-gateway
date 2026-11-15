'use client'

/**
 * 📚 PROMPT LIBRARY DOCUMENTATION
 * ================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  BookOpen, Search, Star, Download, CheckCircle2, 
  ArrowRight, Copy, Upload, Users, Sparkles
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

export default function PromptLibraryDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Prompt Library</h1>
            <p className="text-slate-500">A large library of tested prompts. Save hours of prompt engineering.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: BookOpen, label: 'Prompts', value: 'Large library', color: 'text-teal-600' },
            { icon: Star, label: 'Verified', value: '200+', color: 'text-amber-600' },
            { icon: Users, label: 'Contributors', value: '50+', color: 'text-violet-600' },
            { icon: Download, label: 'Downloads', value: '10k+', color: 'text-emerald-600' },
          ].map((stat) => (
            <GlassCard key={stat.label}>
              <div className="p-4 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* Categories */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Categories</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { name: 'Customer Support', count: 85, desc: 'Ticket classification, response generation' },
                { name: 'Code Generation', count: 120, desc: 'Functions, tests, documentation' },
                { name: 'Data Analysis', count: 65, desc: 'SQL queries, insights extraction' },
                { name: 'Content Writing', count: 95, desc: 'Blog posts, emails, marketing copy' },
                { name: 'Translation', count: 40, desc: 'Multi-language support' },
                { name: 'Summarization', count: 75, desc: 'Documents, meetings, reports' },
              ].map((cat) => (
                <div key={cat.name} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-900">{cat.name}</span>
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{cat.count}</span>
                  </div>
                  <p className="text-xs text-slate-500">{cat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Browse prompts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Browse Prompts</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Search and browse prompts via API:
            </p>
            <CodeBlock 
              language="bash"
              code={`# List all prompts
curl http://localhost:8000/prompts \\
  -H "Authorization: Bearer oxy_sk_..."

# Search by category
curl "http://localhost:8000/prompts?category=customer_support" \\
  -H "Authorization: Bearer oxy_sk_..."

# Search by keyword
curl "http://localhost:8000/prompts?search=email+response" \\
  -H "Authorization: Bearer oxy_sk_..."`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Use a prompt */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Use a Prompt</h2>
            <p className="text-slate-600 mb-4">
              Get a prompt by ID and use it with variables:
            </p>
            <CodeBlock 
              language="python"
              code={`# Get prompt template
prompt = client.get("/prompts/support-ticket-response")

# Template: "You are a customer support agent for {{company}}.
#            The customer says: {{ticket_content}}
#            Respond professionally and helpfully."

# Use with variables
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{
        "role": "system",
        "content": prompt["prompt_text"].replace(
            "{{company}}", "Acme Corp"
        ).replace(
            "{{ticket_content}}", customer_ticket
        )
    }]
)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Submit your own */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="h-6 w-6 text-violet-600" />
              <h2 className="text-xl font-bold text-slate-900">Submit Your Prompt</h2>
            </div>
            <p className="text-slate-600 mb-4">
              Share your best prompts with the community:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/prompts \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Sales Email Generator",
    "description": "Generates personalized sales emails",
    "category": "content_writing",
    "prompt_text": "You are a sales representative for {{company}}...",
    "variables": ["company", "prospect_name", "product"],
    "example_output": "Hi {{prospect_name}}, I noticed..."
  }'`}
            />
            <p className="text-sm text-slate-500 mt-4">
              Submitted prompts are reviewed before publishing (is_verified is set by an
              admin of the deployment).
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Verified badge */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Sparkles className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Verified Prompts</h3>
            <p className="text-sm text-amber-700">
              Prompts with the <span className="bg-amber-200 px-1.5 py-0.5 rounded text-xs font-medium">✓ Verified</span> badge 
              have been reviewed by an admin of this deployment for quality and safety.
              Starting with verified prompts is recommended.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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

