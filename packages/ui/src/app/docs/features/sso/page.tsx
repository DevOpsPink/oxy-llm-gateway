'use client'

/**
 * 🔐 SSO / SAML DOCUMENTATION
 * ============================
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Users, Shield, CheckCircle2, ArrowRight, Copy, 
  Building2, Key, Lock
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

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
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

export default function SSODocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">SSO / SAML</h1>
            <p className="text-slate-500">Single sign-on with your identity provider</p>
          </div>
        </div>
      </motion.div>

      {/* Supported providers */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Supported Identity Providers</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Okta', logo: '🔐', status: 'Full Support' },
                { name: 'Azure AD', logo: '☁️', status: 'Full Support' },
                { name: 'Google Workspace', logo: '🔵', status: 'Full Support' },
                { name: 'OneLogin', logo: '🔑', status: 'Full Support' },
                { name: 'Auth0', logo: '🛡️', status: 'Full Support' },
                { name: 'Custom SAML', logo: '⚙️', status: 'Manual Setup' },
              ].map((provider) => (
                <div key={provider.name} className="p-4 bg-slate-50 rounded-xl text-center">
                  <div className="text-3xl mb-2">{provider.logo}</div>
                  <div className="font-medium text-slate-900">{provider.name}</div>
                  <div className="text-xs text-emerald-600">{provider.status}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Setup steps */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Setup Steps</h2>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Enable SSO', desc: 'Go to Settings → Authentication → Enable SSO' },
                { step: '2', title: 'Configure Provider', desc: 'Enter your SAML metadata URL or upload XML' },
                { step: '3', title: 'Map Attributes', desc: 'Map SAML attributes to Oxy user fields' },
                { step: '4', title: 'Test Connection', desc: 'Use the test button to verify integration' },
                { step: '5', title: 'Enforce SSO', desc: 'Enable "Require SSO" to block password login' },
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

      {/* API configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">API Configuration</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="bash"
              code={`curl -X POST http://localhost:8000/auth/sso/config \\
  -H "Authorization: Bearer oxy_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "okta",
    "domain": "yourcompany.okta.com",
    "client_id": "0oa...",
    "client_secret": "...",
    "metadata_url": "https://yourcompany.okta.com/app/.../sso/saml/metadata",
    "attribute_mapping": {
      "email": "email",
      "name": "displayName",
      "role": "groups"
    },
    "enforce_sso": true,
    "allowed_domains": ["yourcompany.com"]
  }'`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Features */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">SSO Features</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Lock, title: 'Enforce SSO', desc: 'Require SSO for all team members' },
                { icon: Users, title: 'Auto-provisioning', desc: 'Create users on first login (JIT)' },
                { icon: Building2, title: 'Role Mapping', desc: 'Map IdP groups to Oxy roles' },
                { icon: Shield, title: 'Session Control', desc: 'Inherit session policies from IdP' },
              ].map((feature) => (
                <div key={feature.title} className="p-4 bg-slate-50 rounded-xl flex gap-3">
                  <feature.icon className="h-5 w-5 text-violet-600 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-900">{feature.title}</div>
                    <div className="text-sm text-slate-600">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Availability */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
          <Key className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-violet-800 mb-1">Plan gate</h3>
            <p className="text-sm text-violet-700">
              The code gates SSO/SAML to the business and enterprise plans or the SSO add-on. On a
              self-hosted deployment, set the organization's plan in the database to enable it.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/referral-credits" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Referral Credits
          </Link>
          <Link href="/docs/features/key-rotation" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Key Rotation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

