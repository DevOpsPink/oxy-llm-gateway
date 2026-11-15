'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Header } from "@/components/header"
import { ArrowLeft, User as UserIcon, Mail, Key, AlertTriangle, Shield } from 'lucide-react'
import { SSOConfigPanel } from '@/components/auth/sso-config-panel'

import { validateEmail, validateOpenAIKey, sanitizeInput, safeErrorMessage } from '@/lib/utils'
import { authenticatedFetch, handleApiError as parseApiError } from '@/lib/api'
import type { ProviderUpdateRequest } from '@/lib/types/api'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  
  // Form States
  const [fullName, setFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  
  // UI Loading States
  const [nameSubmitting, setNameSubmitting] = useState(false)
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [openaiKeySubmitting, setOpenaiKeySubmitting] = useState(false)
  const [anthropicKeySubmitting, setAnthropicKeySubmitting] = useState(false)
  const [googleKeySubmitting, setGoogleKeySubmitting] = useState(false)
  
  // Modals
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  
  // ARIA live region for accessibility
  const [a11yStatus, setA11yStatus] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  // --- Helpers ---

  const getSessionToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error("Session expired. Please log in again.")
      router.push('/login')
      throw new Error("No session")
    }
    return session.access_token
  }, [supabase.auth, router])

  const handleApiError = useCallback(async (res: Response) => {
    // Handle specific HTTP errors
    if (res.status === 429) {
      toast.error('Rate limit exceeded. Please try again in a few moments.')
      return 'Rate limit exceeded'
    }

    if (res.status === 403) {
      toast.error('Access Denied', {
        description: 'You do not have permission to perform this action.',
      })
      return 'Permission denied'
    }

    if (res.status === 401) {
      toast.error('Session expired. Please log in again.')
      router.push('/login')
      return 'Session expired'
    }

    if (res.status >= 500) {
      toast.error('Server Error', {
        description: 'Our servers are experiencing issues. Please try again later.',
      })
      return 'Server error'
    }

    let errorMsg = 'An unknown error occurred.'
    try {
      const errorData = await res.json()
      if (Array.isArray(errorData.detail)) {
        errorMsg = errorData.detail[0]?.msg || 'Validation error'
      } else if (typeof errorData.detail === 'string') {
        errorMsg = errorData.detail.slice(0, 500) // Limit length
      } else {
        errorMsg = 'An error occurred.'
      }
    } catch (e) {
      try {
        const text = await res.text()
        errorMsg = text.slice(0, 500)
      } catch {
        errorMsg = 'An error occurred.'
      }
    }
    return errorMsg
  }, [router])

  const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
  }

  // --- Effects ---

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }
      setUser(user)
      setFullName(user.user_metadata?.full_name || '')
      
      // Fetch user's organization for SSO config
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL
          const res = await fetch(`${apiUrl}/organizations`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          })
          if (res.ok) {
            const orgs = await res.json()
            if (orgs && orgs.length > 0) {
              setOrganizationId(orgs[0].id)
            }
          }
        }
      } catch (err) {
        // Organization fetch failed - SSO will show locked state
        console.error('Failed to fetch organization:', err)
      }
      
      setLoading(false)
    }
    checkSession()
  }, [supabase, router])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) {
        setUser(session.user)
        setFullName(session.user.user_metadata?.full_name || '')
        toast.success('Account details updated.')
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])


  // --- Handlers ---

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameSubmitting(true)
    
    const cleanName = sanitizeInput(fullName.trim())
    
    if (cleanName.length < 2 || cleanName.length > 100) {
      toast.error('Full Name must be between 2 and 100 characters.')
      setNameSubmitting(false)
      return
    }
    
    // Additional XSS protection
    if (/[<>\"']/.test(cleanName)) {
      toast.error('Name contains invalid characters.')
      setNameSubmitting(false)
      return
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      
      const token = await getSessionToken()
      const res = await authenticatedFetch(
        `${apiUrl}/management/profile`,
        {
          method: 'POST',
          body: JSON.stringify({ full_name: cleanName })
        },
        token
      )
      if (!res.ok) throw new Error(await parseApiError(res))

      // Refresh local user
      const { data: { user: updatedUser } } = await supabase.auth.getUser()
      if (updatedUser) setUser(updatedUser)

      toast.success('Profile updated.')
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    } finally {
      setNameSubmitting(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const emailValidation = validateEmail(newEmail)
    if (!emailValidation.valid) {
      toast.error(emailValidation.error || "Please enter a valid email address.")
      return
    }
    
    setEmailSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error

      toast.success(`Confirmation link sent to ${newEmail}.`)
      setNewEmail('')
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    } finally {
      setEmailSubmitting(false)
    }
  }

  const handleOpenAIKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOpenaiKeySubmitting(true)
    
    const cleanKey = openaiKey.trim()
    
    const keyValidation = validateOpenAIKey(cleanKey)
    if (!keyValidation.valid) {
      toast.error(keyValidation.error || 'Invalid key format.')
      setOpenaiKeySubmitting(false)
      return
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      
      const token = await getSessionToken()
      const payload: ProviderUpdateRequest = {
        provider_name: 'openai',
        openai_key: cleanKey || undefined,
      }
      const res = await authenticatedFetch(
        `${apiUrl}/management/provider`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        },
        token
      )
      if (!res.ok) throw new Error(await parseApiError(res))
      
      toast.success('OpenAI key updated successfully.')
      setOpenaiKey('')
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    } finally {
      setOpenaiKeySubmitting(false)
    }
  }

  const handleAnthropicKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnthropicKeySubmitting(true)
    
    const cleanKey = anthropicKey.trim()
    
    // Anthropic key format: sk-ant-...
    if (!cleanKey.startsWith('sk-ant-')) {
      toast.error('Invalid Anthropic key format. Should start with sk-ant-')
      setAnthropicKeySubmitting(false)
      return
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      
      const token = await getSessionToken()
      const payload: ProviderUpdateRequest = {
        provider_name: 'anthropic',
        anthropic_key: cleanKey || undefined,
      }
      const res = await authenticatedFetch(
        `${apiUrl}/management/provider`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        },
        token
      )
      if (!res.ok) throw new Error(await parseApiError(res))
      
      toast.success('Anthropic (Claude) key updated successfully.')
      setAnthropicKey('')
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    } finally {
      setAnthropicKeySubmitting(false)
    }
  }

  const handleGoogleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGoogleKeySubmitting(true)
    
    const cleanKey = googleKey.trim()
    
    // Google key format: AIza...
    if (!cleanKey.startsWith('AIza')) {
      toast.error('Invalid Google API key format. Should start with AIza')
      setGoogleKeySubmitting(false)
      return
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      
      const token = await getSessionToken()
      const payload: ProviderUpdateRequest = {
        provider_name: 'google',
        google_key: cleanKey || undefined,
      }
      const res = await authenticatedFetch(
        `${apiUrl}/management/provider`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        },
        token
      )
      if (!res.ok) throw new Error(await parseApiError(res))
      
      toast.success('Google Gemini key updated successfully.')
      setGoogleKey('')
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    } finally {
      setGoogleKeySubmitting(false)
    }
  }

  const handleDisconnectProvider = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      
      const token = await getSessionToken()
      const res = await authenticatedFetch(
        `${apiUrl}/management/provider`,
        {
          method: 'DELETE'
        },
        token
      )
      if (!res.ok) throw new Error(await parseApiError(res))
      
      toast.success('Provider disconnected.')
      setIsDisconnectModalOpen(false)
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    }
  }

  const handleDeleteAccount = async () => {
    // Require typed confirmation
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm account deletion')
      return
    }

    setA11yStatus('Deleting account...')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }
      
      const token = await getSessionToken()
      const res = await fetch(`${apiUrl}/management/onboard`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(await handleApiError(res))
      
      toast.success('Account deleted. We\'re sorry to see you go.')
      setA11yStatus('Account deleted successfully. Signing out...')
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error: unknown) {
      const errorMsg = safeErrorMessage(error)
      toast.error(errorMsg)
      setA11yStatus(`Error deleting account: ${errorMsg}`)
    }
  }
  
  // --- Render ---

  if (loading) {
      return (
        <div className="min-h-screen bg-slate-50">
            <Header user={null} title="Settings" />
            <main className="max-w-4xl mx-auto p-8 space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </main>
        </div>
      )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} title="Settings">
        <Button asChild variant="ghost" size="sm" className="hidden sm:flex cursor-pointer text-slate-600 hover:text-slate-900">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </Button>
      </Header>

      {/* ARIA Live Region for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {a11yStatus}
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

        {/* --- Section: Account --- */}
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
                <p className="text-sm text-slate-500">Manage your personal profile and login details.</p>
            </div>
            
            <div className="grid gap-6">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Profile Information</CardTitle>
                    </CardHeader>
                    <form onSubmit={handleNameSubmit} noValidate>
                        <CardContent className="flex gap-6 items-start">
                             <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
                                <AvatarFallback className="bg-slate-100 text-slate-600 text-lg font-medium">
                                    {getInitials(fullName || user?.email || 'U')}
                                </AvatarFallback>
                             </Avatar>
                             <div className="space-y-4 flex-1 max-w-md">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Display Name</Label>
                                    <Input
                                        id="name"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        type="text"
                                        minLength={2}
                                        maxLength={100}
                                        className="bg-white"
                                    />
                                </div>
                             </div>
                        </CardContent>
                        <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end py-3">
                            <Button type="submit" size="sm" disabled={nameSubmitting} className="cursor-pointer">
                                {nameSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Email Address</CardTitle>
                        <CardDescription>Current: {user?.email}</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleEmailSubmit} noValidate>
                        <CardContent>
                            <div className="max-w-md space-y-2">
                                <Label htmlFor="email">New Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        id="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        type="email"
                                        placeholder="you@example.com"
                                        className="pl-9 bg-white"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end py-3">
                            <Button type="submit" size="sm" disabled={emailSubmitting} variant="outline" className="cursor-pointer bg-white">
                                {emailSubmitting ? 'Sending Link...' : 'Update Email'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </section>

        {/* --- Section: Infrastructure (all 3 cloud providers) --- */}
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">AI Provider Keys</h2>
                <p className="text-sm text-slate-500">Connect to OpenAI, Anthropic (Claude), or Google Gemini. Keys are encrypted in Supabase Vault.</p>
            </div>

            {/* OpenAI Card */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-md">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08-4.778 2.758a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-base">OpenAI</CardTitle>
                            <CardDescription className="text-xs">GPT-4, GPT-3.5, o1 • <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="underline">Get key</a></CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <form onSubmit={handleOpenAIKeySubmit} noValidate>
                    <CardContent className="pt-0">
                        <div className="space-y-4 border-t pt-4">
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="openai-key">API Key</Label>
                                </div>
                                <div className="relative">
                                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        id="openai-key"
                                        placeholder="sk-proj-..."
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                        type="password"
                                        className="pl-9 font-mono bg-white text-sm"
                                    />
                                </div>
                             </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end py-3">
                        <Button type="submit" size="sm" disabled={openaiKeySubmitting} className="cursor-pointer">
                            {openaiKeySubmitting ? 'Connecting...' : 'Connect OpenAI'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Anthropic (Claude) Card */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-md">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <path d="M14.753 2h4.717l-9.47 20h-4.717l9.47-20z" fill="currentColor"/>
                              <path d="M4.53 2h4.717l-9.47 20H-4.94L4.53 2z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-base">Anthropic (Claude)</CardTitle>
                            <CardDescription className="text-xs">Claude 3.5 Sonnet, Opus, Haiku • <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">Get key</a></CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <form onSubmit={handleAnthropicKeySubmit} noValidate>
                    <CardContent className="pt-0">
                        <div className="space-y-4 border-t pt-4">
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="anthropic-key">API Key</Label>
                                </div>
                                <div className="relative">
                                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        id="anthropic-key"
                                        placeholder="sk-ant-..."
                                        value={anthropicKey}
                                        onChange={(e) => setAnthropicKey(e.target.value)}
                                        type="password"
                                        className="pl-9 font-mono bg-white text-sm"
                                    />
                                </div>
                             </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end py-3">
                        <Button type="submit" size="sm" disabled={anthropicKeySubmitting} className="cursor-pointer">
                            {anthropicKeySubmitting ? 'Connecting...' : 'Connect Anthropic'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Google Gemini Card */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-md">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-base">Google Gemini</CardTitle>
                            <CardDescription className="text-xs">Gemini 1.5 Pro, Flash • <a href="https://aistudio.google.com/app/api-keys" target="_blank" rel="noopener" className="underline">Get key</a></CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <form onSubmit={handleGoogleKeySubmit} noValidate>
                    <CardContent className="pt-0">
                        <div className="space-y-4 border-t pt-4">
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="google-key">API Key</Label>
                                </div>
                                <div className="relative">
                                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        id="google-key"
                                        placeholder="AIza..."
                                        value={googleKey}
                                        onChange={(e) => setGoogleKey(e.target.value)}
                                        type="password"
                                        className="pl-9 font-mono bg-white text-sm"
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                  <strong>New!</strong> Access Gemini's 1M token context window at 1/10th GPT-4 cost.
                                </p>
                             </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end py-3">
                        <Button type="submit" size="sm" disabled={googleKeySubmitting} className="cursor-pointer">
                            {googleKeySubmitting ? 'Connecting...' : 'Connect Google'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </section>

        {/* --- Section: Enterprise Security (SSO) --- */}
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Enterprise Security</h2>
                <p className="text-sm text-slate-500">Configure Single Sign-On (SSO) for your organization.</p>
            </div>

            <Card className="shadow-sm border-purple-200 bg-linear-to-br from-purple-50/30 to-transparent">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-md">
                            <Shield className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-base">SSO / SAML Configuration</CardTitle>
                            <CardDescription>
                                Enable enterprise authentication for your team
                            </CardDescription>
                        </div>
                        <Badge className="bg-purple-600 text-white">Enterprise</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {organizationId ? (
                        <SSOConfigPanel organizationId={organizationId} />
                    ) : (
                        <div className="p-6 text-center border-2 border-dashed border-purple-200 rounded-lg bg-white/50">
                            <Shield className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-700 mb-1">
                                Organization Required
                            </p>
                            <p className="text-xs text-slate-500 mb-4">
                                SSO configuration is available for organizations on the enterprise plan tier
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="cursor-pointer border-purple-300 text-purple-700 hover:bg-purple-50"
                                onClick={() => router.push('/pricing')}
                            >
                                View plan limits
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>

        {/* --- Section: Danger --- */}
        <section className="space-y-4 pt-4">
             <Card className="shadow-sm border-red-200">
                <CardHeader>
                    <CardTitle className="text-base text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription>
                        Irreversible actions regarding your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm text-slate-900">Delete Account</p>
                            <p className="text-sm text-slate-500">Remove all projects, keys, and data.</p>
                        </div>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="cursor-pointer"
                        >
                            Delete Account
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </section>

      </main>

      {/* --- Modals --- */}

      <Dialog open={isDisconnectModalOpen} onOpenChange={setIsDisconnectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect OpenAI?</DialogTitle>
            <DialogDescription>
                This will stop all API keys across all projects from working. Your projects will remain, but the engine will pause.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDisconnectProvider} className="cursor-pointer">
              Confirm Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => {
        setIsDeleteModalOpen(open)
        if (!open) setDeleteConfirmation('') // Reset on close
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Your Account Forever?</DialogTitle>
            <DialogDescription className="space-y-2">
                <p>This action is <strong>permanent and cannot be undone</strong>.</p>
                <p>All projects, logs, API keys, and data will be wiped immediately.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono">DELETE</code> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
                autoComplete="off"
                aria-describedby="delete-confirm-help"
              />
              <p id="delete-confirm-help" className="text-xs text-slate-500">
                Type the word DELETE in capital letters to enable deletion
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">Cancel</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount} 
              className="cursor-pointer"
              disabled={deleteConfirmation !== 'DELETE'}
            >
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}