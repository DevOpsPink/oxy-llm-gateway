'use client'

/**
 * 🎁 REFERRAL CREDITS DOCUMENTATION
 * ==================================
 *
 * Source: routes/credits.py, core/budget.py (credits in Redis),
 * routes/proxy.py (budget reservation), db/schema.sql (fn_onboard_user)
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Gift, DollarSign, Users, Share2, CheckCircle2,
  ArrowRight, Copy, Shield, AlertTriangle
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

export default function ReferralCreditsDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Referral Credits</h1>
            <p className="text-slate-500">Leftover code: three endpoints and a per-organization credit balance. Redeeming a code does not complete.</p>
          </div>
        </div>
      </motion.div>

      {/* What exists */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What Exists</h2>
            <p className="text-sm text-slate-600 mb-6">
              All three endpoints take a dashboard user&apos;s access token (the Supabase session JWT), not an{' '}
              <code className="bg-slate-100 px-1 rounded">oxy_live_</code> API key.
            </p>

            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-violet-100 flex items-center justify-center">
                  <Share2 className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Referral code</h3>
                <p className="text-sm text-slate-600"><code>GET /management/credits/referral-link</code> returns your code and creates one if you have none</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Redeem</h3>
                <p className="text-sm text-slate-600"><code>POST /management/credits/redeem</code> with <code>{'{"referral_code": "OXY-XXXXX"}'}</code></p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                  <DollarSign className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Balance</h3>
                <p className="text-sm text-slate-600"><code>GET /management/credits/balance</code> reads your organization&apos;s credit balance</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Key facts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <GlassCard>
            <div className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">What the Code Does</h3>
              <ul className="space-y-2">
                {[
                  'Redeem adds REFERRAL_CREDIT_AMOUNT_USD (default 100.00) to the redeeming organization',
                  'It adds the same amount to the code owner\'s organization, but only up to a balance of REFERRAL_MAX_PER_REFERRER_USD (default 1000.00)',
                  'The balance lives only in Redis (credits:<organization_id>) with no expiry; it is not stored in the database',
                  'For projects with a budget_limit above 0, each request\'s budget reservation draws on the credits first; projects with no limit never use them',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">What Does Not Work</h3>
              <ul className="space-y-2">
                {[
                  'Redeem fails with 500 after it has already added the credits and marked your profile: it calls a method the HTTP client does not have, for a database function (fn_increment_referral_count) that db/schema.sql does not define. A retry is refused with 400.',
                  'The referral link is <SITE_URL>/ref/<code>; the dashboard has no /ref route.',
                  'A code entered during onboarding only records who referred you. No credit is added, and a later redeem is refused.',
                  'The limit of 3 redemptions per IP address per 24 hours never takes effect: its counter is written after the failing step.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>
        </div>
      </motion.div>

      {/* Get your link */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Get Your Referral Code</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock
              language="bash"
              code={`curl http://localhost:8000/management/credits/referral-link \\
  -H "Authorization: Bearer <user access token>"

# Response
{
  "referral_code": "OXY-A7F2X",
  "referral_link": "http://localhost:3000/ref/OXY-A7F2X",
  "total_referrals": 0,
  "total_earned": "<decimal>"
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Check balance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Check Credit Balance</h2>
            <CodeBlock
              language="bash"
              code={`curl http://localhost:8000/management/credits/balance \\
  -H "Authorization: Bearer <user access token>"

# Response
{
  "organization_id": "<uuid>",
  "balance": "0.00",
  "formatted_balance": "$0.00"
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              <strong>Note:</strong> the reservation that draws on credits is the gateway&apos;s estimate of a
              request&apos;s maximum cost. If the credits cover only part of it, the balance is set to 0 and the rest goes
              against the project budget.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Checks on redeem */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Checks Before Redeem Adds Credits</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• The code must match <code>OXY-</code> plus 5 letters or digits (422 otherwise); unknown codes return 404</li>
              <li>• Refused with 400 if you were already referred, if the code is your own, or if you belong to no organization</li>
              <li>• Refused with 400 if the two emails match after lowercasing and dropping a <code>+suffix</code> (and dots, for gmail.com and googlemail.com), or share a domain other than gmail.com, yahoo.com, hotmail.com or outlook.com with one local part containing the other</li>
              <li>• Refused with 400 if the request comes from the signup IP address of either account</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/budgets" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← Budgets & Alerts
          </Link>
          <Link href="/docs/features/sso" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: SSO / SAML <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
