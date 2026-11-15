'use client'

/**
 * 🔑 KEY ROTATION DOCUMENTATION
 * ==============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  RefreshCw, Shield, CheckCircle2, ArrowRight, Copy, 
  AlertTriangle, Clock, Key
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

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
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

export default function KeyRotationDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Key Rotation</h1>
            <p className="text-slate-500">Age-based warnings with optional enforcement; Oxy nudges, you rotate.</p>
          </div>
        </div>
      </motion.div>

      {/* Why rotate */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Why Rotate Keys?</h2>
            <ul className="space-y-3">
              {[
                'Reduce blast radius if a key is compromised',
                'Stay aligned with common audit expectations (e.g., 90-day hygiene)',
                'Encourage fresh credentials across teams and services',
                'Create a visible trail of key age and nudges'
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

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works (env-managed)</h2>
            <div className="space-y-4">
              {[
                { day: 'Fresh', title: 'Under warning threshold', desc: 'Pass-through, no headers.' },
                { day: 'Warning', title: '>= warning_days', desc: 'Allow + headers: X-Oxy-Key-Rotation-Status: warning; age/expires-in/URL.' },
                { day: 'Expired', title: '>= max_days', desc: 'mode=warn → allow with status=expired; mode=enforce → 403 key_rotation_required.' },
              ].map((item) => (
                <div key={item.day} className="flex items-start gap-4">
                  <div className="w-16 text-sm font-mono text-violet-600">{item.day}</div>
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

      {/* Rotate key */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Configure policy (env)</h2>
        <GlassCard>
          <div className="p-6">
                <p className="text-slate-600 mb-4">
                  Set warning/enforce thresholds per deployment. Oxy does not auto-rotate keys; you own the rotation.
                </p>
            <CodeBlock 
                  language="bash"
                  code={`KEY_ROTATION_MODE=warn        # off|warn|enforce (default warn)
KEY_ROTATION_WARNING_DAYS=80
KEY_ROTATION_MAX_DAYS=90
# Headers when warning/expired:
# X-Oxy-Key-Rotation-Status, X-Oxy-Key-Age-Days, X-Oxy-Key-Expires-In-Days, X-Oxy-Key-Rotation-URL`}
            />
                <p className="text-sm text-slate-500 mt-4">
                  <strong>Enforcement is opt-in:</strong> set MODE=enforce to block at max_days. Defaults warn-only.
                </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Check key age */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Check Key Age (example response)</h2>
            <CodeBlock 
              language="bash"
              code={`HTTP/1.1 200 OK
X-Oxy-Key-Rotation-Status: warning
X-Oxy-Key-Age-Days: 85
X-Oxy-Key-Expires-In-Days: 5
X-Oxy-Key-Rotation-URL: http://localhost:3000/dashboard/api-keys`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* What happens if blocked */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">When a Key Expires</h3>
            <p className="text-sm text-amber-700 mb-2">
              mode=enforce returns 403 with structured error:
            </p>
            <CodeBlock 
              language="json"
              code={`// HTTP 403 Forbidden (mode=enforce)
{
  "error": {
    "code": "key_rotation_required",
    "message": "API key must be rotated before further use.",
    "key_age_days": 95,
    "max_age_days": 90,
    "mode": "enforce"
  }
}`}
            />
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/sso" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← SSO / SAML
          </Link>
          <Link href="/docs/features/csv-export" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: CSV Export <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

