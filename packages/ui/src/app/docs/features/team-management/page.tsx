'use client'

/**
 * 👥 TEAM MANAGEMENT DOCUMENTATION
 * =================================
 * 
 * Source: routes/team.py
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Users, CheckCircle2, ArrowRight, Copy, 
  Mail, Shield, Crown, Eye, Trash2
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

const roles = [
  {
    name: 'Owner',
    icon: Crown,
    color: 'bg-amber-100 text-amber-700',
    permissions: ['All permissions', 'Delete organization', 'Transfer ownership', 'Manage billing'],
  },
  {
    name: 'Admin',
    icon: Shield,
    color: 'bg-violet-100 text-violet-700',
    permissions: ['Invite members', 'Manage projects', 'View all agents', 'Edit settings'],
  },
  {
    name: 'Developer',
    icon: Users,
    color: 'bg-blue-100 text-blue-700',
    permissions: ['Create agents', 'Manage own projects', 'View logs', 'Use API'],
  },
  {
    name: 'Viewer',
    icon: Eye,
    color: 'bg-slate-100 text-slate-700',
    permissions: ['View dashboard', 'View logs (read-only)', 'View reports'],
  },
]

export default function TeamManagementDocs() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-500">Invite teammates, assign roles, control access</p>
          </div>
        </div>
      </motion.div>

      {/* Roles */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Roles & Permissions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {roles.map((role) => (
            <GlassCard key={role.name}>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${role.color} flex items-center justify-center`}>
                    <role.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{role.name}</h3>
                </div>
                <ul className="space-y-1">
                  {role.permissions.map((perm) => (
                    <li key={perm} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* Invite flow */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Invite Team Members</h2>
        
        <GlassCard className="mb-4">
          <div className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-violet-600" />
              Via Dashboard
            </h3>
            <ol className="space-y-2 text-slate-600">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">1</div>
                <span>Go to <strong>Settings → Team</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">2</div>
                <span>Click <strong>"Invite Member"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">3</div>
                <span>Enter email and select role</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">4</div>
                <span>Teammate receives email with invite link</span>
              </li>
            </ol>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Via API</h3>
            <CodeBlock 
              language="bash"
              code={`# Invite a team member
curl -X POST http://localhost:8000/management/team/invite \\
  -H "Authorization: Bearer <jwt_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "jane@company.com",
    "role": "developer"
  }'

# Response
{
  "status": "invited",
  "email": "jane@company.com",
  "role": "developer",
  "expires_at": "2025-01-22T10:00:00Z"
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Accept invite */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Accept Invite (API)</h2>
            <CodeBlock 
              language="bash"
              code={`# Accept invitation (called by invitee)
curl -X POST http://localhost:8000/management/team/invite/accept \\
  -H "Authorization: Bearer <invitee_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "invite_token": "abc123xyz789..."
  }'

# Response
{
  "status": "accepted",
  "organization_id": "org_abc123",
  "organization_name": "Acme Corp",
  "role": "developer"
}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Manage invites */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Manage Invites</h2>
            <CodeBlock 
              language="bash"
              code={`# List pending invites
curl http://localhost:8000/management/team/invites \\
  -H "Authorization: Bearer <jwt_token>"

# Response
{
  "invites": [
    {
      "id": "inv_123",
      "email": "jane@company.com",
      "role": "developer",
      "status": "pending",
      "invited_at": "2025-01-15T10:00:00Z",
      "expires_at": "2025-01-22T10:00:00Z"
    }
  ]
}

# Revoke invite
curl -X DELETE http://localhost:8000/management/team/invite/inv_123 \\
  -H "Authorization: Bearer <jwt_token>"`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Plan limits */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Team Size by Plan Tier</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-600">Plan</th>
                    <th className="text-center py-2 text-slate-600">Team Members</th>
                    <th className="text-center py-2 text-slate-600">Roles Available</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">Free</td>
                    <td className="py-2 text-center">1</td>
                    <td className="py-2 text-center">Owner only</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">Starter</td>
                    <td className="py-2 text-center">3</td>
                    <td className="py-2 text-center">All roles</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">Growth</td>
                    <td className="py-2 text-center">10</td>
                    <td className="py-2 text-center">All roles</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">Business</td>
                    <td className="py-2 text-center">50</td>
                    <td className="py-2 text-center">All roles</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Enterprise</td>
                    <td className="py-2 text-center">Unlimited</td>
                    <td className="py-2 text-center">All roles + SSO</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Security note */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <h3 className="font-semibold text-violet-800 mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Notes
          </h3>
          <ul className="space-y-2 text-sm text-violet-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Invite links expire</strong> after 7 days</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Only owners</strong> can invite members and manage billing</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>All invites are logged</strong> in the audit trail</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Use SSO</strong> on Business+ plans for centralized access control</span>
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="flex justify-between items-center pt-8 border-t border-slate-200">
          <Link href="/docs/integrations/hubspot" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            ← HubSpot Integration
          </Link>
          <Link href="/docs/features/sso" className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
            Next: SSO / SAML <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

