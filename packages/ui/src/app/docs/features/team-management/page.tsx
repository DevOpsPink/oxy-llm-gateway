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
    permissions: ['Invite, list and revoke invites (/management/team)', 'Delete agents', 'Everything an admin can do'],
  },
  {
    name: 'Admin',
    icon: Shield,
    color: 'bg-violet-100 text-violet-700',
    permissions: ['Create and update agents', 'Reset agent budgets', 'Not offered by /management/team invites'],
  },
  {
    name: 'Developer',
    icon: Users,
    color: 'bg-blue-100 text-blue-700',
    permissions: ['Default role of /management/team invites', 'No owner- or admin-only actions'],
  },
  {
    name: 'Viewer',
    icon: Eye,
    color: 'bg-slate-100 text-slate-700',
    permissions: ['Accepted as an invite role', 'Not a membership role: organization_members.role allows owner, admin and developer only'],
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
                <span>Open the <strong>Team</strong> page</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">2</div>
                <span>Click <strong>&quot;Invite Member&quot;</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">3</div>
                <span>Enter the email and a role (the API accepts developer or viewer)</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">4</div>
                <span>With EMAIL_ENABLED=true and RESEND_API_KEY set, the engine emails a link to SITE_URL/invite/&#123;token&#125;; otherwise no email is sent</span>
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
    "email": "jane@example.com",
    "role": "developer",
    "organization_id": "<org uuid>"
  }'

# Response (caller must be the organization's owner, else 403)
{
  "status": "invited",
  "email": "jane@example.com",
  "expires_in_hours": 48
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
  "organization_id": "<org uuid>",
  "organization_name": "Example Org"
}`}
            />
            <p className="text-xs text-slate-600 mt-4">
              Not available in this release: the endpoint answers 501. It called fn_accept_team_invite, which
              db/schema.sql does not define, so accepting failed; the dashboard no longer offers invitations.
              An operator adds a member as a row in organization_members.
            </p>
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
              code={`# List invites (all statuses, newest first; owner only)
curl "http://localhost:8000/management/team/invites?organization_id=<org uuid>" \\
  -H "Authorization: Bearer <jwt_token>"

# Response
[
  {
    "id": "<invite uuid>",
    "email": "jane@example.com",
    "role": "developer",
    "created_at": "2026-01-15T10:00:00+00:00",
    "expires_at": "2026-01-17T10:00:00+00:00",
    "status": "pending"
  }
]

# Revoke invite (owner only) -> {"status": "revoked"}
curl -X DELETE http://localhost:8000/management/team/invite/<invite uuid> \\
  -H "Authorization: Bearer <jwt_token>"

# Same with an Oxy API key (Bearer oxy_live_...) or the dashboard's session; creating and
# revoking an invite needs an owner or admin of the organization (403 otherwise):
# GET    /v1/team                      -> {"members": [...], "invites": [...]}
# POST   /v1/team/invites              {"email", "role"} -> the invite row; no email is sent
#        (role developer, the default, or viewer; any other role answers 422)
# DELETE /v1/team/invites/{invite_id}  -> {"status": "ok"}`}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Plan limits */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Team-Member Caps by Plan Tier</h2>
            <p className="text-sm text-slate-600 mb-4">
              The tier is set on the organization in the database. These caps are defined in PLAN_LIMITS
              (packages/engine/routes/billing.py), but the invite endpoints in this build do not check them.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-600">Plan tier</th>
                    <th className="text-center py-2 text-slate-600">Team members</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">free</td>
                    <td className="py-2 text-center">1</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">starter</td>
                    <td className="py-2 text-center">3</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">growth</td>
                    <td className="py-2 text-center">10</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-medium">business</td>
                    <td className="py-2 text-center">50</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">enterprise</td>
                    <td className="py-2 text-center">No cap</td>
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
              <span><strong>Invites carry expires_at</strong> 48 hours after creation</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Only owners</strong> can invite, list and revoke through /management/team; /v1/team accepts any API key of the organization</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Tokens are stored hashed:</strong> only the SHA-256 of the invite token is saved</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Audit log:</strong> /v1/team invite creation and revocation are recorded as team.invite.created and team.invite.revoked; /management/team writes only to the engine log</span>
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

