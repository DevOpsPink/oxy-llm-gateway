'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

type Member = {
  id: string
  email?: string
  name?: string
  role?: string
  joined_at?: string
}

type Invite = {
  id: string
  email: string
  role: string
  status: string
  created_at?: string
  expires_at?: string | null
}

type TeamResponse = {
  members: Member[]
  invites: Invite[]
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'developer', label: 'Developer' },
  { value: 'viewer', label: 'Viewer' },
]

export default function TeamPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TeamResponse | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const fetchTeam = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/team`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const sendInvite = async () => {
    if (!token || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/team/invites`,
        {
          method: 'POST',
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      setInviteEmail('')
      setInviteRole('member')
      fetchTeam()
    } catch (err) {
      setInviteError(safeErrorMessage(err))
    } finally {
      setInviting(false)
    }
  }

  const revokeInvite = async (id: string) => {
    if (!token) return
    if (!confirm('Revoke this invite?')) return
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/team/invites/${id}`,
        { method: 'DELETE' },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      fetchTeam()
    } catch (err) {
      alert(safeErrorMessage(err))
    }
  }

  const renderMembers = () => {
    if (loading) return <Skeleton className="h-32 w-full" />
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not load team. <button className="underline" onClick={fetchTeam}>Retry</button>
        </div>
      )
    }
    if (!data || !data.members.length) {
      return <div className="text-sm text-muted-foreground">No members yet.</div>
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.name || '—'}</TableCell>
              <TableCell>{m.email || '—'}</TableCell>
              <TableCell>
                <Badge variant="outline">{m.role || 'member'}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const renderInvites = () => {
    if (loading) return <Skeleton className="h-32 w-full" />
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not load invites. <button className="underline" onClick={fetchTeam}>Retry</button>
        </div>
      )
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? 'Sending…' : 'Send invite'}
          </Button>
        </div>
        {inviteError && <div className="text-sm text-red-600">{inviteError}</div>}
        <div className="text-sm font-semibold">Pending invites</div>
        {(!data || !data.invites.length) && (
          <div className="text-sm text-muted-foreground">No pending invites.</div>
        )}
        {data && data.invites.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell><Badge variant="outline">{inv.role}</Badge></TableCell>
                  <TableCell>{inv.status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.created_at ? new Date(inv.created_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    {inv.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => revokeInvite(inv.id)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Team" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Team & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage your team, roles, and invites.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent>{renderMembers()}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invites</CardTitle>
            </CardHeader>
            <CardContent>{renderInvites()}</CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

