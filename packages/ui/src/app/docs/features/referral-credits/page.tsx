'use client'

/**
 * 🎁 REFERRAL CREDITS DOCUMENTATION
 * ==================================
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
            <p className="text-slate-500">Both orgs receive a usage credit; the amount is set by the operator.</p>
          </div>
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
            
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-violet-100 flex items-center justify-center">
                  <Share2 className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">1. Share Your Link</h3>
                <p className="text-sm text-slate-600">Get your unique referral link from the dashboard</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">2. Friend Signs Up</h3>
                <p className="text-sm text-slate-600">They create an account using your link</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                  <DollarSign className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">3. Both Get Credits</h3>
                <p className="text-sm text-slate-600">Credits added to both accounts</p>
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
              <h3 className="font-semibold text-slate-900 mb-3">What You Get</h3>
              <ul className="space-y-2">
                {[
                  'A credit per referral (REFERRAL_CREDIT_AMOUNT_USD)',
                  'Capped per referrer (REFERRAL_MAX_PER_REFERRER_USD)',
                  'Credits never expire',
                  'Applied before budget charges'
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
              <h3 className="font-semibold text-slate-900 mb-3">Your Friend Gets</h3>
              <ul className="space-y-2">
                {[
                  'Referral credits on signup',
                  'Full access to all features',
                  'Same free tier benefits',
                  'Their own referral link'
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
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
        <h2 className="text-xl font-bold text-slate-900 mb-4">Get Your Referral Link</h2>
        <GlassCard>
          <div className="p-6">
            <p className="text-slate-600 mb-4">
              Find your unique referral link in the dashboard, or via API:
            </p>
            <CodeBlock 
              language="bash"
              code={`curl http://localhost:8000/management/credits/referral-link \\
  -H "Authorization: Bearer oxy_sk_..."

# Response
{
  "referral_code": "OXY-A7F2X",
  "referral_link": "http://localhost:3000/login?ref=OXY-A7F2X",
  "total_referrals": 5,
  "total_credits_earned": 500.00
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
  -H "Authorization: Bearer oxy_sk_..."

# Response
{
  "credits_available": 350.00,
  "credits_used": 150.00,
  "credits_earned_total": 500.00,
  "next_usage_source": "credits"  // Credits used before budget
}`}
            />
            <p className="text-sm text-slate-500 mt-4">
              <strong>Note:</strong> Credits are automatically applied to your usage before 
              your budget is charged. If you have $10 in credits and make a $15 request, 
              $10 comes from credits and $5 from your budget.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Fraud protection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-1">Fraud Protection</h3>
            <p className="text-sm text-amber-700 mb-2">
              The engine detects and blocks referral fraud automatically:
            </p>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Self-referrals are blocked (same email domain detection)</li>
              <li>• Same IP referrals within 24 hours are blocked</li>
              <li>• Gmail aliases (user+1@gmail.com) are normalized</li>
              <li>• Suspicious patterns trigger manual review</li>
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

