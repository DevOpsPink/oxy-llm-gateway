'use client'

/**
 * 🔗 HUBSPOT INTEGRATION DOCUMENTATION
 * =====================================
 * 
 * Source: integrations/hubspot.py
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Link2, CheckCircle2, ArrowRight, Copy, 
  Users, FileText, Bell, RefreshCw
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

export default function HubSpotDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Link2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">HubSpot Integration</h1>
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">CRM</span>
            </div>
            <p className="text-slate-500">Best-effort outbound sync of contacts/deals/notes to HubSpot (does not affect billing if unavailable)</p>
          </div>
        </div>
      </motion.div>

      {/* What syncs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">What Gets Synced</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Users, title: 'Contacts', desc: 'New signups → HubSpot contacts', when: 'On user signup' },
                { icon: FileText, title: 'Deals', desc: 'Subscriptions → HubSpot deals', when: 'On subscription' },
                { icon: Bell, title: 'Notes', desc: 'Activity → Contact timeline', when: 'On events' },
                { icon: RefreshCw, title: 'Properties', desc: 'Usage data → Custom fields', when: 'Daily sync' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600">{item.desc}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Setup */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Setup</h2>
        <GlassCard>
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">1</div>
                <h3 className="font-semibold text-slate-900">Get HubSpot API Key</h3>
              </div>
              <ol className="ml-11 space-y-1 text-sm text-slate-600">
                <li>1. Go to HubSpot → Settings → Integrations → Private Apps</li>
                <li>2. Create a new private app</li>
                <li>3. Grant scopes: <code className="bg-slate-100 px-1 rounded">crm.objects.contacts.write</code>, <code className="bg-slate-100 px-1 rounded">crm.objects.deals.write</code></li>
                <li>4. Copy the access token</li>
              </ol>
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">2</div>
                <h3 className="font-semibold text-slate-900">Configure in Oxy</h3>
              </div>
              <CodeBlock 
                language="bash"
                code={`# Add to your environment variables
HUBSPOT_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`}
              />
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">3</div>
                <h3 className="font-semibold text-slate-900">Enable in Dashboard</h3>
              </div>
              <p className="ml-11 text-sm text-slate-600">
                Go to <strong>Settings → Integrations → HubSpot</strong> and toggle "Enable Sync"
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Contact sync */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Contact Properties Synced</h2>
        <GlassCard>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-600">Oxy Field</th>
                    <th className="text-left py-2 text-slate-600">HubSpot Property</th>
                    <th className="text-left py-2 text-slate-600">Type</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b border-slate-100">
                    <td className="py-2">email</td>
                    <td className="py-2">email</td>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded text-xs">string</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2">full_name</td>
                    <td className="py-2">firstname, lastname</td>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded text-xs">string</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2">company</td>
                    <td className="py-2">company</td>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded text-xs">string</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2">plan_tier</td>
                    <td className="py-2">oxy_plan (custom)</td>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded text-xs">string</code></td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2">total_spend</td>
                    <td className="py-2">oxy_total_spend (custom)</td>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded text-xs">number</code></td>
                  </tr>
                  <tr>
                    <td className="py-2">created_at</td>
                    <td className="py-2">oxy_signup_date (custom)</td>
                    <td className="py-2"><code className="bg-slate-100 px-1 rounded text-xs">date</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Deal stages */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Deal Stage Mapping</h2>
            <div className="space-y-3">
              {[
                { oxy: 'User signs up', hubspot: 'lead', color: 'bg-blue-100 text-blue-700' },
                { oxy: 'Trial started', hubspot: 'trial', color: 'bg-amber-100 text-amber-700' },
                { oxy: 'Subscription active', hubspot: 'customer', color: 'bg-emerald-100 text-emerald-700' },
                { oxy: 'Subscription canceled', hubspot: 'churned', color: 'bg-red-100 text-red-700' },
              ].map((stage) => (
                <div key={stage.oxy} className="flex items-center gap-4">
                  <div className="w-1/3 text-sm text-slate-600">{stage.oxy}</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className={`px-2 py-1 rounded text-xs font-medium ${stage.color}`}>
                    {stage.hubspot}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* API example */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Manual Sync (API)</h2>
        <GlassCard>
          <div className="p-6">
            <CodeBlock 
              language="python"
              code={`from integrations.hubspot import sync_user_to_hubspot, track_subscription_in_hubspot

# Sync a user to HubSpot
user_data = {
    'id': 'user_123',
    'email': 'john@acme.com',
    'full_name': 'John Smith',
    'company': 'Acme Corp',
    'job_title': 'CTO',
    'lead_score': 85
}

contact = sync_user_to_hubspot(user_data)
print(f"HubSpot contact: {contact['id']}")

# Track subscription as deal
deal = track_subscription_in_hubspot(
    user_data=user_data,
    plan='growth',
    amount=1200.00  # the price you charge, from your own Stripe product
)
print(f"HubSpot deal: {deal['id']}")`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/features/mcp-monitoring" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← MCP Monitoring
          </Link>
          <Link href="/docs/features/team-management" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: Team Management <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

