'use client'

/**
 * 📚 PROMPT LIBRARY DOCUMENTATION
 * ================================
 *
 * Source: routes/prompts_v1.py (/v1/prompts), routes/prompts.py (legacy /prompts),
 * db/schema.sql (prompts table)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BookOpen, Search, Star, Key, CheckCircle2,
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
            <p className="text-slate-500">Prompts stored in this deployment&apos;s database: your organization&apos;s own, plus any an operator has marked verified.</p>
          </div>
        </div>
      </motion.div>

      {/* Facts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: BookOpen, label: 'Endpoint', value: '/v1/prompts/', color: 'text-teal-600' },
            { icon: Key, label: 'Auth', value: 'oxy_live_ key', color: 'text-violet-600' },
            { icon: Users, label: 'You see', value: 'Org + verified', color: 'text-emerald-600' },
            { icon: Star, label: 'Page size', value: '20 (max 100)', color: 'text-amber-600' },
          ].map((stat) => (
            <GlassCard key={stat.label}>
              <div className="p-4 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
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
            <p className="text-sm text-slate-600 mb-4">
              You do not set a category directly. It is taken from your first tag: the first category below whose
              keyword appears inside that tag wins, otherwise <code className="bg-slate-100 px-1 rounded">other</code>.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { name: 'customer_support', keys: 'support, customer, cs' },
                { name: 'code_generation', keys: 'code, coding, dev, engineering' },
                { name: 'data_analysis', keys: 'data, analysis, analytics' },
                { name: 'content_writing', keys: 'content, writing, blog, copy' },
                { name: 'translation', keys: 'translate, translation' },
                { name: 'summarization', keys: 'summary, summarize, summarization' },
              ].map((cat) => (
                <div key={cat.name} className="p-3 bg-slate-50 rounded-xl">
                  <div className="font-medium text-slate-900 mb-1"><code>{cat.name}</code></div>
                  <p className="text-xs text-slate-500">Keywords: {cat.keys}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Browse prompts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-teal-600" /> Browse Prompts
        </h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              The list holds prompts written by active members of your organization and verified prompts from anyone
              on the deployment, ordered by <code className="bg-slate-100 px-1 rounded">usage_count</code>.
            </p>
            <CodeBlock
              language="bash"
              code={`# List prompts (default 20, max 100)
curl "http://localhost:8000/v1/prompts/?limit=50" \\
  -H "Authorization: Bearer oxy_live_..."

# Filter by category (the parameter is called tag)
curl "http://localhost:8000/v1/prompts/?tag=customer_support" \\
  -H "Authorization: Bearer oxy_live_..."

# Search title, description and prompt text
curl "http://localhost:8000/v1/prompts/?search=email" \\
  -H "Authorization: Bearer oxy_live_..."

# Response
{ "items": [ { "id": "...", "title": "...", "prompt_text": "...", "category": "...", "tags": [...], "is_verified": false, ... } ] }`}
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
              <code className="bg-slate-100 px-1 rounded">GET /v1/prompts/{'{id}'}</code> returns one prompt (404 if it does not
              exist, 403 if it is neither verified nor written by your organization). Oxy does not fill in placeholders;
              replace them in your own code.
            </p>
            <CodeBlock
              language="python"
              code={`import httpx
from openai import OpenAI

OXY_KEY = "oxy_live_..."

prompt = httpx.get(
    "http://localhost:8000/v1/prompts/<prompt id>",
    headers={"Authorization": f"Bearer {OXY_KEY}"},
).json()

client = OpenAI(api_key=OXY_KEY, base_url="http://localhost:8000/v1")
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": prompt["prompt_text"].replace("{company}", "Acme Corp")},
        {"role": "user", "content": customer_ticket},
    ],
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
              <h2 className="text-xl font-bold text-slate-900">Add, Edit and Delete Prompts</h2>
            </div>
            <CodeBlock
              language="bash"
              code={`curl -X POST http://localhost:8000/v1/prompts/ \\
  -H "Authorization: Bearer oxy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Support email reply",
    "description": "Drafts a reply to a customer email",
    "content": "You are a support agent for {company}. Reply politely to the email below.",
    "tags": ["support", "email"]
  }'

# 201 Created, returns the stored prompt`}
            />
            <ul className="text-sm text-slate-600 space-y-1 mt-4">
              <li>• The database requires a name of 10 to 100 characters, a description of 20 to 500 (a default text is used if you omit it) and content of 50 to 10,000. A request that passes the API&apos;s looser checks but breaks these fails with 500 &quot;Failed to create prompt&quot;.</li>
              <li>• New prompts are stored with <code className="bg-slate-100 px-1 rounded">is_verified: false</code> and <code className="bg-slate-100 px-1 rounded">recommended_model: &quot;gpt-4.1-mini&quot;</code>; tags are returned as <code className="bg-slate-100 px-1 rounded">tags</code>.</li>
              <li>• <code className="bg-slate-100 px-1 rounded">PATCH /v1/prompts/{'{id}'}</code> (name, description, content, tags) and <code className="bg-slate-100 px-1 rounded">DELETE /v1/prompts/{'{id}'}</code> (204) work only on prompts written by a member of your organization; otherwise 403.</li>
            </ul>
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
              No API sets <code>is_verified</code>. An operator sets it in the <code>prompts</code> table, and a verified
              prompt becomes visible to every organization on the deployment. The table also has leftover columns
              (<code>is_premium</code>, <code>price_usd</code>, ratings); they have no effect. The older{' '}
              <code>/prompts</code> router (without <code>/v1</code>) serves two built-in sample prompts and saves nothing.
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
