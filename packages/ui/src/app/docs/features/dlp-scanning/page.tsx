'use client'

/**
 * 👁️ DLP SCANNING DOCUMENTATION
 * =============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Eye, Shield, CheckCircle2, 
  ArrowRight, Copy, Key, CreditCard, FileKey
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

export default function DLPScanningDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Eye className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">DLP Scanning</h1>
            <p className="text-slate-500">Block secrets in prompts before they reach a provider</p>
          </div>
        </div>
      </motion.div>

      {/* What it detects */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What We Detect</h2>
            <p className="text-slate-600 mb-4">
              Oxy matches every <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/v1/chat/completions</code> request
              against the regex patterns in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">DLP_PATTERNS</code> (packages/engine/core.py):
              the text of every message, and the name, description and parameters of every tool and legacy function. It runs in
              every environment. Patterns match formats, not meaning: a secret in another format passes.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Key, label: 'Model Provider Keys', examples: 'OpenAI sk-... / sk-proj-..., Anthropic sk-ant-api03-..., Google AIza...', color: 'bg-rose-100 text-rose-600' },
                { icon: Key, label: 'AWS Access Key IDs', examples: 'AKIA... (secret access keys are not matched)', color: 'bg-amber-100 text-amber-600' },
                { icon: CreditCard, label: 'Card Numbers', examples: 'Visa, Mastercard, Amex, Diners, Discover formats (no checksum test)', color: 'bg-violet-100 text-violet-600' },
                { icon: FileKey, label: 'Private Keys', examples: 'PEM headers: RSA, EC, DSA, OpenSSH or plain PRIVATE KEY', color: 'bg-cyan-100 text-cyan-600' },
                { icon: Shield, label: 'JWTs', examples: 'eyJ... three-part tokens', color: 'bg-emerald-100 text-emerald-600' },
                { icon: Key, label: 'Stripe Live Keys', examples: 'sk_live_... (test keys are not matched)', color: 'bg-pink-100 text-pink-600' },
                { icon: Key, label: 'GitHub and Slack Tokens', examples: 'ghp_/gho_/ghu_/ghs_/ghr_..., github_pat_..., xoxb-/xoxp-/...', color: 'bg-slate-200 text-slate-700' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.examples}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-4">
              An email address alone is not blocked. An email address together with an
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm mx-1">api_key=...</code> assignment in the same request is.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Request Arrives', desc: 'A request reaches POST /v1/chat/completions; the agent, session and kill-switch checks run first' },
                { step: '2', title: 'Pattern Matching', desc: 'Messages and tool definitions are matched against DLP_PATTERNS, before the budget reservation and the cache lookup' },
                { step: '3', title: 'Block', desc: 'Any match refuses the request with 451 DLP_BLOCKED; it never reaches the provider' },
                { step: '4', title: 'Record', desc: 'The request is written to request_logs with status blocked and the first matched pattern as threat_type' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Configuration</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              DLP is always on and always blocks. There is no project setting, no block / redact / alert switch and no
              custom pattern list. To change what is matched, edit <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">DLP_PATTERNS</code> in
              packages/engine/core.py and rebuild the engine. An excerpt:
            </p>
            <CodeBlock 
              language="python"
              code={`DLP_PATTERNS = {
    "openai_key": r'sk-proj-[a-zA-Z0-9]{48}|sk-[a-zA-Z0-9]{48}',
    "anthropic_key": r'sk-ant-api03-[a-zA-Z0-9_-]{95}',
    "aws_key": r'AKIA[0-9A-Z]{16}',
    "stripe_key": r'sk_live_[a-zA-Z0-9]{24,}',
    "private_key": r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
    # ... jwt, github_token, slack_token, google_api_key, credit_card
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Response when blocked */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">When a Threat is Detected</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              When any pattern matches, the response names the first matched pattern:
            </p>
            <CodeBlock 
              language="json"
              code={`// HTTP 451
{
  "error": {
    "code": "DLP_BLOCKED",
    "message": "Request blocked: Sensitive data detected (openai_key).",
    "hint": "Remove openai_key from your message content. Do NOT include API keys, passwords, SSNs, credit cards, or PII in prompts."
  }
}`}
            />
            <p className="text-slate-600 mt-4">
              Tool calls in a provider&apos;s non-streaming response are not blocked: arguments that match a pattern are
              replaced with <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">[REDACTED_&lt;PATTERN&gt;]</code> before
              Oxy returns the response, and with an X-Oxy-Session-Id the call is logged to tool_call_logs.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Best practices */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h3 className="font-semibold text-emerald-800 mb-2">Best Practices</h3>
          <ul className="space-y-2 text-sm text-emerald-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              Use environment variables for secrets, never hardcode in prompts
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              Test with <code className="bg-emerald-100 px-1 rounded">model: &quot;oxy-mock&quot;</code>: DLP runs before the mock answers, so a blocked prompt returns 451 without a provider call
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              To catch your own secret formats, add a pattern to DLP_PATTERNS
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/kill-switch" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Kill Switch
          </Link>
          <Link href="/docs/features/response-caching" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Response Caching <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

