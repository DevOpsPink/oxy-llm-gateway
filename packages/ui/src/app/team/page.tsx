"use client"

/**
 * TEAM MANAGEMENT PAGE
 * ====================
 * 
 * Built with shadcn/ui components
 * Mobile responsive with card fallback
 * 
 * Features:
 * - Shadcn/ui Table, Card, Button, Badge components
 * - Responsive design (mobile cards, desktop table)
 * - Beautiful loading states with skeletons
 * - Accessible dialogs and alerts
 * - Error handling with toasts
 * - RBAC permission checks
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Header } from '@/components/header'
import { toast } from 'sonner'
import { Users, UserPlus, Crown, Shield, Code, AlertTriangle, ArrowLeft, Mail, Trash2 } from 'lucide-react'

type TeamMember = {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'developer'
  status: 'pending' | 'active' | 'suspended'
  invited_at: string
  joined_at: string | null
  profiles: {
    full_name: string
    email: string
  } | null
}

type InviteForm = {
  email: string
  role: 'admin' | 'developer'
}

export default function TeamPage() {
  const [user, setUser] = useState<any>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState<InviteForm>({ email: '', role: 'developer' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Helper function for authenticated API calls
  async function authenticatedFetch(endpoint: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    return fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`,
      },
    })
  }

  const loadTeamData = useCallback(async () => {
    try {
      setLoading(true)

      // Get current user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (sessionError || !session || !user) {
        router.push('/login')
        return
      }

      setUser(user)

      // Get user's organization from management API
      const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/management/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!statusRes.ok) {
        throw new Error('Failed to fetch organization status')
      }

      const statusData = await statusRes.json()
      
      if (!statusData.organization_id) {
        toast.error('You are not a member of any organization')
        router.push('/dashboard')
        return
      }

      setOrganizationId(statusData.organization_id)
      setOrganizationName(statusData.organization_name || 'My Organization')
      setUserRole(statusData.role)

      // Check if user has permission to view team (must be admin or owner)
      if (!['owner', 'admin'].includes(statusData.role)) {
        toast.error('Only admins and owners can manage team members')
        router.push('/dashboard')
        return
      }

      // Fetch team members from Supabase
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          status,
          invited_at,
          joined_at,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('organization_id', statusData.organization_id)
        .order('joined_at', { ascending: false })

      if (membersError) {
        throw membersError
      }

      setMembers((membersData || []) as unknown as TeamMember[])
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load team:', err)
      }
      toast.error(err.message || 'Failed to load team members')
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadTeamData()
  }, [loadTeamData])

  async function inviteMember() {
    if (!inviteForm.email || !organizationId) return

    try {
      setInviteLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // ✅ IMPLEMENTED: Backend API (Task #3 complete)
      const res = await authenticatedFetch('/management/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          email: inviteForm.email,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to send invitation')
      }

      toast.success('Invitation sent successfully!', {
        description: `An email has been sent to ${inviteForm.email}`,
      })
      
      // Reset form and close modal
      setInviteForm({ email: '', role: 'developer' })
      setShowInviteModal(false)
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to invite member:', err)
      }
      toast.error(err.message || 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  async function updateMemberRole(memberId: string, newRole: 'admin' | 'developer') {
    try {
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (updateError) {
        throw updateError
      }

      toast.success('Member role updated successfully')
      await loadTeamData()
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to update role:', err)
      }
      toast.error(err.message || 'Failed to update member role')
    }
  }

  async function removeMember(member: TeamMember) {
    try {
      const { error: deleteError } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', member.id)

      if (deleteError) {
        throw deleteError
      }

      toast.success(`${member.profiles?.full_name || 'Member'} removed from team`)
      setMemberToRemove(null)
      await loadTeamData()
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to remove member:', err)
      }
      toast.error(err.message || 'Failed to remove team member')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown
      case 'admin': return Shield
      case 'developer': return Code
      default: return Users
    }
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      owner: { variant: 'default', className: 'bg-purple-600 hover:bg-purple-700' },
      admin: { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700' },
      developer: { variant: 'secondary' }
    }
    return variants[role] || { variant: 'secondary' }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: { variant: 'default', className: 'bg-green-600 hover:bg-green-700' },
      pending: { variant: 'secondary', className: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
      suspended: { variant: 'destructive' }
    }
    return variants[status] || { variant: 'secondary' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header user={user} title="Team">
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </Header>
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} title="Team">
        <Button asChild variant="ghost" size="sm" className="hidden sm:flex cursor-pointer">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </Button>
      </Header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-600 mt-2">{organizationName}</p>
          </div>
          {['owner', 'admin'].includes(userRole) && (
            <Button onClick={() => setShowInviteModal(true)} className="cursor-pointer">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Team Members Table (Desktop) */}
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                {['owner', 'admin'].includes(userRole) && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-slate-100 h-16 w-16 rounded-full flex items-center justify-center">
                        <Users className="h-8 w-8 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-900">No team members yet</p>
                        <p className="text-sm text-slate-500 mt-1">Invite your first team member to get started</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const RoleIcon = getRoleIcon(member.role)
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-slate-900 text-white">
                              {member.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-slate-900">
                              {member.profiles?.full_name || 'Unknown'}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {member.profiles?.email || member.user_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {['owner', 'admin'].includes(userRole) && member.role !== 'owner' ? (
                          <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value as 'admin' | 'developer')}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Admin
                                </div>
                              </SelectItem>
                              <SelectItem value="developer">
                                <div className="flex items-center gap-2">
                                  <Code className="h-4 w-4" />
                                  Developer
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge {...getRoleBadge(member.role)}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge {...getStatusBadge(member.status)}>
                          {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {member.joined_at 
                          ? new Date(member.joined_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : 'Pending'
                        }
                      </TableCell>
                      {['owner', 'admin'].includes(userRole) && (
                        <TableCell className="text-right">
                          {member.role !== 'owner' && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setMemberToRemove(member)}
                              aria-label={`Remove ${member.profiles?.email ?? 'member'}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Team Members Cards (Mobile) */}
        <div className="md:hidden space-y-4">
          {members.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-slate-100 h-16 w-16 rounded-full flex items-center justify-center">
                    <Users className="h-8 w-8 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">No team members yet</p>
                    <p className="text-sm text-slate-500 mt-1">Invite your first team member to get started</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            members.map((member) => {
              const RoleIcon = getRoleIcon(member.role)
              return (
                <Card key={member.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-slate-900 text-white">
                            {member.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{member.profiles?.full_name || 'Unknown'}</CardTitle>
                          <CardDescription className="text-xs flex items-center gap-1 mt-1">
                            <Mail className="h-3 w-3" />
                            {member.profiles?.email || member.user_id}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Role</span>
                      <Badge {...getRoleBadge(member.role)}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Status</span>
                      <Badge {...getStatusBadge(member.status)}>
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Joined</span>
                      <span className="text-sm text-slate-900">
                        {member.joined_at 
                          ? new Date(member.joined_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : 'Pending'
                        }
                      </span>
                    </div>
                  </CardContent>
                  {['owner', 'admin'].includes(userRole) && member.role !== 'owner' && (
                    <CardFooter className="pt-0">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full cursor-pointer"
                        onClick={() => setMemberToRemove(member)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove from Team
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              )
            })
          )}
        </div>

        {/* Invite Modal */}
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization as a team member.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value as 'admin' | 'developer' })}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="developer">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Developer</div>
                          <div className="text-xs text-slate-500">Can view and use API</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Admin</div>
                          <div className="text-xs text-slate-500">Can manage projects and team</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-blue-900">
                    An invitation email with a magic link will be sent to this address.
                  </p>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="cursor-pointer">Cancel</Button>
              </DialogClose>
              <Button 
                onClick={inviteMember} 
                disabled={inviteLoading || !inviteForm.email}
                className="cursor-pointer"
              >
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Member Confirmation */}
        <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{memberToRemove?.profiles?.full_name}</strong> from your organization? 
                They will lose access to all projects and API keys.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => memberToRemove && removeMember(memberToRemove)}
                className="cursor-pointer bg-red-600 hover:bg-red-700"
              >
                Remove Member
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}
