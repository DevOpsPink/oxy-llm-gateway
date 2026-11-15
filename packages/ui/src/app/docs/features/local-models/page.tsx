'use client'

/**
 * 🖥️ LOCAL MODELS DOCUMENTATION
 * ==============================
 *
 * Source: providers/local_provider.py, providers/__init__.py,
 * routes/proxy.py (get_provider_api_key), db/schema.sql (providers table)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Server, CheckCircle2, ArrowRight, Copy, AlertTriangle
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

export default function LocalModelsDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Server className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">Local Models</h1>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">Not wired end to end</span>
            </div>
            <p className="text-slate-500">Provider adapters for Ollama, vLLM and Docker Model Runner exist; the gateway does not reach them yet.</p>
          </div>
        </div>
      </motion.div>

      {/* Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 space-y-2">
            <h3 className="font-semibold text-amber-800">Current status</h3>
            <p>
              <code className="bg-amber-100 px-1 rounded">POST /v1/chat/completions</code> picks a provider from the
              model name, then looks up that provider&apos;s stored API key for your organization before it calls
              anything. For local model names the provider is <code className="bg-amber-100 px-1 rounded">ollama</code>,{' '}
              <code className="bg-amber-100 px-1 rounded">vllm</code>, <code className="bg-amber-100 px-1 rounded">docker</code> or{' '}
              <code className="bg-amber-100 px-1 rounded">local</code>. The <code className="bg-amber-100 px-1 rounded">providers</code> table
              only accepts <code className="bg-amber-100 px-1 rounded">openai</code>, <code className="bg-amber-100 px-1 rounded">anthropic</code>,{' '}
              <code className="bg-amber-100 px-1 rounded">google</code> and <code className="bg-amber-100 px-1 rounded">meta</code>, and
              the environment-variable fallback covers only OpenAI, Anthropic and Google. So such a request is refused
              with HTTP 400 (&quot;Provider &apos;ollama&apos; not configured&quot;) and never reaches the local server.
            </p>
            <p>
              The <code className="bg-amber-100 px-1 rounded">provider_local_enabled</code> organization setting
              (<code className="bg-amber-100 px-1 rounded">/v1/providers/config</code>) is stored, but the gateway does not read it.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Adapters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Adapters in the Code</h2>
            <p className="text-slate-600 mb-4 text-sm">
              Each adapter calls the backend&apos;s OpenAI-compatible <code className="bg-slate-100 px-1 rounded">/v1/chat/completions</code> endpoint,
              with and without streaming, and reports a cost of zero for its own calls.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Ollama', emoji: '🦙', desc: 'OllamaProvider', url: 'https://ollama.ai' },
                { name: 'vLLM', emoji: '⚡', desc: 'VLLMProvider', url: 'https://vllm.ai' },
                { name: 'Docker Model Runner', emoji: '🐳', desc: 'DockerModelRunnerProvider', url: 'https://docker.com' },
              ].map((provider) => (
                <div key={provider.name} className="p-4 bg-slate-50 rounded-xl text-center">
                  <div className="text-3xl mb-2">{provider.emoji}</div>
                  <div className="font-semibold text-slate-900">{provider.name}</div>
                  <div className="text-sm text-slate-600 mb-2"><code>{provider.desc}</code></div>
                  <a href={provider.url} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-violet-600 hover:underline">
                    {provider.url.replace('https://', '')} ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Model naming */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How a Model Name Maps to an Adapter</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-600">Model Name</th>
                    <th className="text-left py-2 text-slate-600">Adapter</th>
                    <th className="text-left py-2 text-slate-600">Name sent to the backend</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">ollama/llama3.2</code></td>
                    <td>Ollama</td>
                    <td><code className="text-emerald-600">llama3.2</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">vllm/mistral-7b</code></td>
                    <td>vLLM</td>
                    <td><code className="text-violet-600">mistral-7b</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">docker/llama3.2</code></td>
                    <td>Docker Model Runner</td>
                    <td><code className="text-blue-600">llama3.2</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">local/phi-3</code></td>
                    <td>Ollama</td>
                    <td><code className="text-amber-600">phi-3</code></td>
                  </tr>
                  <tr>
                    <td className="py-2">Starts with <code className="bg-slate-100 px-1 rounded">llama</code>, <code className="bg-slate-100 px-1 rounded">mistral</code>, <code className="bg-slate-100 px-1 rounded">codellama</code>, <code className="bg-slate-100 px-1 rounded">phi</code>, <code className="bg-slate-100 px-1 rounded">gemma</code>, <code className="bg-slate-100 px-1 rounded">qwen</code>, <code className="bg-slate-100 px-1 rounded">deepseek</code>, <code className="bg-slate-100 px-1 rounded">vicuna</code>, <code className="bg-slate-100 px-1 rounded">orca</code></td>
                    <td>Ollama</td>
                    <td><code className="text-slate-600">unchanged</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              The gateway&apos;s own cost tracking reads its model cost table, which has no local models, so a local
              request would be recorded at the default cost for unknown models, not at zero.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Environment variables */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Environment Variables the Adapters Read</h2>
            <CodeBlock
              language="bash"
              code={`OLLAMA_BASE_URL=http://localhost:11434    # default
VLLM_BASE_URL=http://localhost:8000       # default (the engine also listens on 8000 in docker-compose)
DOCKER_MODEL_URL=http://localhost:12434   # default
LOCAL_MODEL_TIMEOUT=120                   # seconds, default`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/response-caching" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Response Caching
          </Link>
          <Link href="/docs/features/agent-templates" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Agent Templates <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
