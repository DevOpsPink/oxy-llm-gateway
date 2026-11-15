'use client'

/**
 * 💾 RESPONSE CACHING DOCUMENTATION
 * ==================================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Database, DollarSign, Zap, CheckCircle2, 
  ArrowRight, Copy, Clock, TrendingDown
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

export default function ResponseCachingDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Response Caching</h1>
            <p className="text-slate-500">Reduce costs on repeated, identical AI requests</p>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: TrendingDown, label: 'Typical Impact', value: 'Lower cost on repeats', color: 'text-emerald-600' },
            { icon: Clock, label: 'Cache TTL', value: 'Configurable', color: 'text-violet-600' },
            { icon: DollarSign, label: 'When it applies', value: 'Identical prompt/model/temp requests', color: 'text-amber-600' },
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

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-slate-600 mb-4">
              Oxy automatically caches responses for identical requests. When you send the same prompt 
              to the same model with the same parameters, we return the cached response instead of 
              calling the AI provider again.
            </p>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <div className="text-sm font-mono text-slate-600">
                <div className="mb-2"><span className="text-violet-600">Cache Key</span> = SHA-256(</div>
                <div className="ml-4">provider + model + system_prompt + user_prompt + temperature + max_tokens</div>
                <div>)</div>
              </div>
            </div>

            <h3 className="font-semibold text-slate-900 mb-2">When caching applies:</h3>
            <ul className="space-y-2">
              {[
                'Deterministic requests (temperature = 0)',
                'Non-streaming requests',
                'Same model and provider',
                'Identical prompt content'
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

      {/* Example */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Example Usage</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              No code changes needed! Caching works automatically. Just use temperature=0 for 
              deterministic responses:
            </p>
            <CodeBlock 
              language="python"
              code={`# This request will be cached automatically
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is 2+2?"}
    ],
    temperature=0  # ← Deterministic = cacheable
)

# Second identical request → served from cache (free!)
response2 = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is 2+2?"}
    ],
    temperature=0
)
# response2 is identical to response, but cost $0`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Cache headers */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Cache Headers</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Check response headers to see if a response was cached:
            </p>
            <CodeBlock 
              language="http"
              code={`X-Oxy-Cache: HIT          # Response served from cache
X-Oxy-Cache: MISS         # Response from AI provider (now cached)
X-Oxy-Cache-TTL: 604800   # Seconds until expiry (7 days)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* When NOT to cache */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-2">When Caching Does NOT Apply</h3>
          <ul className="space-y-2 text-sm text-amber-700">
            <li>• <strong>Creative requests:</strong> temperature &gt; 0 (responses should vary)</li>
            <li>• <strong>Streaming:</strong> stream=true (can't cache partial responses)</li>
            <li>• <strong>Tool calls:</strong> Function calls that depend on real-time data</li>
            <li>• <strong>Different parameters:</strong> Any change to model, max_tokens, etc.</li>
          </ul>
        </div>
      </motion.div>

      {/* Disable caching */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Disable Caching</h2>
            <p className="text-slate-600 mb-4">
              If you need fresh responses every time, add the no-cache header:
            </p>
            <CodeBlock 
              language="python"
              code={`# Force fresh response (skip cache)
response = client.chat.completions.create(
    model="gpt-4",
    messages=[...],
    temperature=0,
    extra_headers={
        "X-Oxy-Cache-Control": "no-cache"
    }
)`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/dlp-scanning" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← DLP Scanning
          </Link>
          <Link href="/docs/features/cost-optimizer" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: AI Cost Optimizer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

