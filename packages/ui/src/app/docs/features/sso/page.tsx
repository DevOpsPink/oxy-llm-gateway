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
            <p className="text-slate-500">Email-domain sign-in through a Supabase Auth SSO provider</p>
          </div>
        </div>
      </motion.div>

      {/* Endpoints */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Endpoints</h2>
            <p className="text-sm text-slate-600 mb-4">
              The engine does not talk to identity providers itself. It stores the UUID of an SSO provider configured
              in Supabase Auth and maps an email domain to an organization.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { method: 'POST', path: '/auth/sso/lookup', auth: 'No auth', desc: 'Body {"email"}. Answers sso_available, organization_id, organization_name, sso_provider_id and login_method (sso or password).' },
                { method: 'POST', path: '/auth/sso/configure', auth: 'User JWT', desc: 'Body {"domain", "provider_id"}. Requires the sso add-on for the caller\'s organization.' },
                { method: 'POST', path: '/auth/sso/callback', auth: 'No Authorization header', desc: 'Answers 501 in this release (it did not verify the identity provider assertion).' },
                { method: 'GET', path: '/auth/sso/status/{organization_id}', auth: 'User JWT, active member', desc: 'sso_enabled, sso_domain, sso_domain_verified, sso_configured_at (read from organizations.settings), subscription_plan, can_configure_sso.' },
              ].map((endpoint) => (
                <div key={endpoint.path} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{endpoint.method}</code>
                    <code className="text-sm font-medium text-slate-900">{endpoint.path}</code>
                  </div>
                  <div className="text-xs text-emerald-600 mb-1">{endpoint.auth}</div>
                  <div className="text-sm text-slate-600">{endpoint.desc}</div>
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
                { step: '1', title: 'Enable the add-on', desc: 'An operator inserts an sso row for the organization into organization_add_ons. Without it, configure answers 403.' },
                { step: '2', title: 'Create the provider in Supabase Auth', desc: 'Configure the SSO provider in Supabase Auth and copy its UUID; Oxy stores it as provider_id.' },
                { step: '3', title: 'Claim the domain', desc: 'Call POST /auth/sso/configure with domain and provider_id as an active member of the organization.' },
                { step: '4', title: 'Look up at sign-in', desc: 'POST /auth/sso/lookup with the user\'s email tells the client whether to use SSO or password sign-in.' },
                { step: '5', title: 'Join after sign-in', desc: 'Not available in this release: POST /auth/sso/callback answers 501.' },
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
              code={`curl -X POST http://localhost:8000/auth/sso/configure \\
  -H "Authorization: Bearer <user_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "example.com",
    "provider_id": "<supabase-auth-sso-provider-uuid>"
  }'

# Response
{
  "success": true,
  "message": "...",
  "domain": "example.com",
  "verification_required": false,
  "error": null
}`}
            />
            <p className="text-xs text-slate-600 mt-4">
              Errors: 403 without the sso add-on or without an active membership; 403 permission_denied, 402
              plan_required, 409 domain_taken or 400 when the database function rejects the request; 500 otherwise.
            </p>
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
                { icon: Lock, title: 'Fails open', desc: 'If the domain lookup fails, /auth/sso/lookup answers login_method password.' },
                { icon: Users, title: 'Auto-join', desc: 'Not available in this release (the callback answers 501).' },
                { icon: Building2, title: 'One organization per domain', desc: 'organizations.sso_domain is unique.' },
                { icon: Shield, title: 'Audit table', desc: 'sso_audit_log exists and owners and admins can read it, but no engine code writes to it in this build.' },
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
            <p className="text-xs text-slate-600 mt-4">
              Not implemented: blocking password sign-in, attribute or group-to-role mapping, and identity provider
              session policies.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Availability */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
          <Key className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-violet-800 mb-1">Gates and current state</h3>
            <p className="text-sm text-violet-700">
              Configuration is gated by the sso add-on in organization_add_ons. The dashboard&apos;s SSO panel is a
              separate check: it unlocks only when /auth/sso/status returns can_configure_sso, which is true only when
              the organization&apos;s subscriptions row has plan_tier enterprise.
            </p>
            <p className="text-sm text-violet-700 mt-2">
              The database functions these endpoints call (fn_get_sso_provider_by_domain, fn_configure_sso,
              fn_sso_auto_join_user) are not defined in db/schema.sql. On a database built from it, lookup answers
              password and configure answers 500 after the add-on check. The callback answers 501: it took the user id and email from the request body without verifying the identity provider, so it stays off until it does.
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

