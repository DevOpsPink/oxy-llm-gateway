'use client'

/**
 * 👁️ DLP SCANNING DOCUMENTATION
 * =============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Eye, Shield, AlertTriangle, CheckCircle2, 
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
            <p className="text-slate-500">Prevent sensitive data from leaking to AI models</p>
          </div>
        </div>
      </motion.div>

      {/* What it detects */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What We Detect</h2>
            <p className="text-slate-600 mb-4">
              Oxy scans every prompt and tool call for sensitive data patterns. Detection is automatic 
              and happens in real-time with zero latency impact.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Key, label: 'API Keys', examples: 'OpenAI sk-..., Anthropic sk-ant-...', color: 'bg-rose-100 text-rose-600' },
                { icon: Key, label: 'AWS Credentials', examples: 'AKIA..., Secret Access Keys', color: 'bg-amber-100 text-amber-600' },
                { icon: CreditCard, label: 'Credit Cards', examples: 'Visa, Mastercard, Amex numbers', color: 'bg-violet-100 text-violet-600' },
                { icon: FileKey, label: 'Private Keys', examples: 'RSA, EC, DSA private keys', color: 'bg-cyan-100 text-cyan-600' },
                { icon: Shield, label: 'JWT Tokens', examples: 'eyJ... Bearer tokens', color: 'bg-emerald-100 text-emerald-600' },
                { icon: Key, label: 'Stripe Keys', examples: 'sk_live_..., sk_test_...', color: 'bg-pink-100 text-pink-600' },
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
                { step: '1', title: 'Request Arrives', desc: 'Your AI request comes through the Oxy proxy' },
                { step: '2', title: 'Pattern Matching', desc: 'We scan the prompt using optimized regex patterns' },
                { step: '3', title: 'Threat Detection', desc: 'If sensitive data is found, we flag the request' },
                { step: '4', title: 'Action', desc: 'Based on your settings: block, redact, or alert' },
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
              DLP scanning is enabled by default. Configure behavior in your project settings:
            </p>
            <CodeBlock 
              language="json"
              code={`{
  "dlp": {
    "enabled": true,
    "action": "block",  // "block" | "redact" | "alert"
    "patterns": {
      "api_keys": true,
      "aws_credentials": true,
      "credit_cards": true,
      "private_keys": true,
      "jwt_tokens": true,
      "custom": [
        {
          "name": "internal_employee_id",
          "pattern": "EMP-[0-9]{6}",
          "action": "redact"
        }
      ]
    }
  }
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
              If DLP detects sensitive data and <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">action: "block"</code> is set:
            </p>
            <CodeBlock 
              language="json"
              code={`// HTTP 400 Bad Request
{
  "error": {
    "code": "DLP_THREAT_DETECTED",
    "message": "Sensitive data detected in request",
    "threat_type": "openai_key",
    "threat_count": 1,
    "action": "blocked"
  }
}`}
            />
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
              Start with <code className="bg-emerald-100 px-1 rounded">action: "alert"</code> to monitor before blocking
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              Add custom patterns for your organization's sensitive data formats
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

