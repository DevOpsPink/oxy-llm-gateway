'use client'

/**
 * 🔧 INSTALLATION GUIDE
 * =====================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Cpu, CheckCircle2, Copy, ArrowRight, 
  Terminal, Key, Zap, AlertTriangle
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

function CodeBlock({ code, language = 'bash', title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="relative group">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-t-xl border-b border-slate-700">
          <span className="text-sm text-slate-400">{title}</span>
          <span className="text-xs text-slate-500 font-mono">{language}</span>
        </div>
      )}
      <pre className={`bg-slate-900 text-slate-100 p-4 overflow-x-auto text-sm font-mono ${title ? 'rounded-b-xl' : 'rounded-xl'}`}>
        <code>{code}</code>
      </pre>
      <button onClick={handleCopy} className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
      </button>
    </div>
  )
}

export default function InstallationDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Installation</h1>
            <p className="text-slate-500">Get started in minutes</p>
          </div>
        </div>
      </motion.div>

      {/* Prerequisites */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Prerequisites</h2>
            <ul className="space-y-2">
              {[
                'A running Oxy stack (docker compose up)',
                'Your OpenAI, Anthropic, or Google API key',
                'Python 3.8+ or Node.js 16+ (or any language with HTTP support)'
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

      {/* Step 1 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
            <span className="text-violet-700 font-bold">1</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Create a Project</h2>
        </div>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Log in to your Oxy dashboard and create a new project:
            </p>
            <ol className="space-y-2 text-slate-600 mb-4">
              <li>1. Go to <strong>Dashboard → Projects</strong></li>
              <li>2. Click <strong>"Create Project"</strong></li>
              <li>3. Enter a name (e.g., "My AI App")</li>
              <li>4. Set a budget limit (optional, recommended: $100)</li>
            </ol>
            <div className="bg-slate-100 rounded-xl p-4 text-center text-slate-500">
              [Dashboard screenshot: Create Project form]
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Step 2 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
            <span className="text-violet-700 font-bold">2</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Get Your API Key</h2>
        </div>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Create an Oxy API key for your project:
            </p>
            <ol className="space-y-2 text-slate-600 mb-4">
              <li>1. In your project, go to <strong>Settings → API Keys</strong></li>
              <li>2. Click <strong>"Create API Key"</strong></li>
              <li>3. Copy the key (starts with <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">oxy_sk_</code>)</li>
            </ol>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Key className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">Save Your Key</h3>
                <p className="text-sm text-amber-700">
                  Copy the key now — you won't be able to see it again. Store it securely 
                  (e.g., environment variables, secrets manager).
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Step 3 - Code Examples */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
            <span className="text-violet-700 font-bold">3</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Update Your Code</h2>
        </div>
        
        {/* Python */}
        <GlassCard className="mb-4">
          <div className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-600" />
              Python (OpenAI SDK)
            </h3>
            <CodeBlock 
              title="Before"
              language="python"
              code={`from openai import OpenAI

client = OpenAI(api_key="sk-...")`}
            />
            <div className="my-4 flex justify-center">
              <ArrowRight className="h-6 w-6 text-violet-500" />
            </div>
            <CodeBlock 
              title="After (2 lines changed)"
              language="python"
              code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-...",                          # Your OpenAI key
    base_url="http://localhost:8000/v1",          # ← Add this
    default_headers={
        "Authorization": "Bearer oxy_sk_..."   # ← Add your Oxy key
    }
)`}
            />
          </div>
        </GlassCard>

        {/* JavaScript */}
        <GlassCard className="mb-4">
          <div className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-yellow-600" />
              JavaScript / TypeScript
            </h3>
            <CodeBlock 
              title="After"
              language="typescript"
              code={`import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-...',                           // Your OpenAI key
  baseURL: 'http://localhost:8000/v1',           // ← Add this
  defaultHeaders: {
    'Authorization': 'Bearer oxy_sk_...'      // ← Add your Oxy key
  }
});`}
            />
          </div>
        </GlassCard>

        {/* cURL */}
        <GlassCard>
          <div className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-600" />
              cURL / Any HTTP Client
            </h3>
            <CodeBlock 
              language="bash"
              code={`curl http://localhost:8000/v1/chat/completions \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -H "X-OpenAI-Key: sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Step 4 - Verify */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Verify It Works</h2>
        </div>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Make a test request and check your Oxy dashboard:
            </p>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                Request appears in <strong>Dashboard → Logs</strong>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                Cost is tracked in <strong>Dashboard → Usage</strong>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                Response headers include <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">X-Oxy-Request-Id</code>
              </li>
            </ul>
          </div>
        </GlassCard>
      </motion.div>

      {/* Next steps */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-6">
          <h3 className="font-semibold text-violet-800 mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            You're Protected! What's Next?
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Set up Kill Switch', href: '/docs/features/kill-switch', desc: 'Emergency stop for rogue agents' },
              { title: 'Enable DLP', href: '/docs/features/dlp-scanning', desc: 'Prevent data leaks' },
              { title: 'Configure Budgets', href: '/docs/features/budgets', desc: 'Prevent surprise bills' },
              { title: 'Add Cost Attribution', href: '/docs/features/cost-attribution', desc: 'Track costs by customer' },
            ].map((item) => (
              <Link key={item.title} href={item.href} className="block p-3 bg-white rounded-xl hover:shadow-md transition-shadow">
                <div className="font-medium text-violet-700">{item.title}</div>
                <div className="text-sm text-slate-600">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Back to Docs
          </Link>
          <Link href="/docs/features/kill-switch" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Kill Switch <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

