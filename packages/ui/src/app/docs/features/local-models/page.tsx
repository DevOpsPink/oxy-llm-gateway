'use client'

/**
 * 🖥️ LOCAL MODELS DOCUMENTATION
 * ==============================
 * 
 * Source: providers/local_provider.py
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Server, CheckCircle2, ArrowRight, Copy, 
  DollarSign, Shield, Zap, Terminal, Box
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
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">All plan tiers</span>
            </div>
            <p className="text-slate-500">Run AI locally with Ollama, vLLM, or Docker. Zero API costs.</p>
          </div>
        </div>
      </motion.div>

      {/* Benefits */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: DollarSign, title: '$0 API Cost', desc: 'No per-token charges', color: 'text-emerald-600' },
            { icon: Shield, title: 'Data Privacy', desc: 'Nothing leaves your server', color: 'text-violet-600' },
            { icon: Zap, title: 'Low Latency', desc: 'No network round-trip', color: 'text-amber-600' },
          ].map((benefit) => (
            <GlassCard key={benefit.title}>
              <div className="p-4 text-center">
                <benefit.icon className={`h-6 w-6 mx-auto mb-2 ${benefit.color}`} />
                <div className="font-semibold text-slate-900">{benefit.title}</div>
                <div className="text-sm text-slate-600">{benefit.desc}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* Supported Providers */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Supported Local Providers</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Ollama', emoji: '🦙', desc: 'Easiest setup', url: 'https://ollama.ai' },
                { name: 'vLLM', emoji: '⚡', desc: 'High throughput', url: 'https://vllm.ai' },
                { name: 'Docker Model Runner', emoji: '🐳', desc: 'Docker native', url: 'https://docker.com' },
              ].map((provider) => (
                <div key={provider.name} className="p-4 bg-slate-50 rounded-xl text-center">
                  <div className="text-3xl mb-2">{provider.emoji}</div>
                  <div className="font-semibold text-slate-900">{provider.name}</div>
                  <div className="text-sm text-slate-600 mb-2">{provider.desc}</div>
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

      {/* Ollama Setup */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          🦙 Ollama Setup
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">Recommended</span>
        </h2>
        <GlassCard>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">1</div>
              <h3 className="font-semibold text-slate-900">Install Ollama</h3>
            </div>
            <CodeBlock 
              title="macOS / Linux"
              language="bash"
              code={`curl -fsSL https://ollama.ai/install.sh | sh`}
            />
            
            <div className="flex items-center gap-3 mb-4 mt-6">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">2</div>
              <h3 className="font-semibold text-slate-900">Pull a Model</h3>
            </div>
            <CodeBlock 
              language="bash"
              code={`# Pull Llama 3.2 (recommended)
ollama pull llama3.2

# Or other models
ollama pull mistral
ollama pull codellama
ollama pull phi3`}
            />
            
            <div className="flex items-center gap-3 mb-4 mt-6">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">3</div>
              <h3 className="font-semibold text-slate-900">Use with Oxy</h3>
            </div>
            <CodeBlock 
              title="Python"
              language="python"
              code={`from openai import OpenAI

client = OpenAI(
    api_key="oxy_sk_...",
    base_url="http://localhost:8000/v1"
)

# Use local model via Oxy
response = client.chat.completions.create(
    model="ollama/llama3.2",  # ← Prefix with "ollama/"
    messages=[{"role": "user", "content": "Hello!"}]
)

# Or just the model name (auto-detected)
response = client.chat.completions.create(
    model="llama3.2",  # ← Ollama model names auto-routed
    messages=[{"role": "user", "content": "Hello!"}]
)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* vLLM Setup */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          ⚡ vLLM Setup
          <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded">High Performance</span>
        </h2>
        <GlassCard>
          <div className="p-6 space-y-4">
            <CodeBlock 
              title="Install & Start vLLM"
              language="bash"
              code={`# Install vLLM
pip install vllm

# Start the server
python -m vllm.entrypoints.openai.api_server \\
  --model mistralai/Mistral-7B-v0.1 \\
  --port 8000`}
            />
            
            <CodeBlock 
              title="Use with Oxy"
              language="python"
              code={`# Use vLLM model via Oxy
response = client.chat.completions.create(
    model="vllm/mistral-7b",  # ← Prefix with "vllm/"
    messages=[{"role": "user", "content": "Hello!"}]
)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Docker Model Runner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          🐳 Docker Model Runner
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Docker Native</span>
        </h2>
        <GlassCard>
          <div className="p-6 space-y-4">
            <p className="text-slate-600 mb-4">
              Docker's built-in AI model runner. Enable it in Docker Desktop settings.
            </p>
            <CodeBlock 
              title="Run a model"
              language="bash"
              code={`# Enable in Docker Desktop → Settings → Features → AI Models

# Run a model
docker model run llama3.2`}
            />
            
            <CodeBlock 
              title="Use with Oxy"
              language="python"
              code={`# Use Docker model via Oxy
response = client.chat.completions.create(
    model="docker/llama3.2",  # ← Prefix with "docker/"
    messages=[{"role": "user", "content": "Hello!"}]
)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Model naming */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Model Naming Convention</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-600">Model Name</th>
                    <th className="text-left py-2 text-slate-600">Provider</th>
                    <th className="text-left py-2 text-slate-600">Example</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">ollama/model</code></td>
                    <td>Ollama</td>
                    <td><code className="text-emerald-600">ollama/llama3.2</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">vllm/model</code></td>
                    <td>vLLM</td>
                    <td><code className="text-violet-600">vllm/mistral-7b</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">docker/model</code></td>
                    <td>Docker</td>
                    <td><code className="text-blue-600">docker/llama3.2</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">local/model</code></td>
                    <td>Auto-detect</td>
                    <td><code className="text-amber-600">local/phi-3</code></td>
                  </tr>
                  <tr>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded">llama3.2</code></td>
                    <td>Auto-detect Ollama</td>
                    <td><code className="text-slate-600">llama3.2, mistral, phi3</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* What still works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h3 className="font-semibold text-emerald-800 mb-2">✅ All Oxy Features Work with Local Models</h3>
          <ul className="space-y-1 text-sm text-emerald-700">
            <li>• <strong>DLP Scanning</strong> — Secrets still scanned before reaching local model</li>
            <li>• <strong>Audit Logging</strong> — All requests logged for compliance</li>
            <li>• <strong>Rate Limiting</strong> — Protect your local GPU from overload</li>
            <li>• <strong>Kill Switch</strong> — Stop any agent instantly</li>
            <li>• <strong>Cost Tracking</strong> — Shows $0.00 (but tracks usage)</li>
          </ul>
        </div>
      </motion.div>

      {/* Environment variables */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Environment Configuration</h2>
            <CodeBlock 
              language="bash"
              code={`# Optional: Configure local model endpoints
OLLAMA_BASE_URL=http://localhost:11434    # Default Ollama
VLLM_BASE_URL=http://localhost:8000       # Default vLLM
DOCKER_MODEL_URL=http://localhost:12434   # Default Docker
LOCAL_MODEL_TIMEOUT=120                   # Seconds (local can be slow)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
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

