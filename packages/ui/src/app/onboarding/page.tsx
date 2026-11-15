'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Header } from "@/components/header"
import { Label } from '@/components/ui/label'
import { ShieldCheck, Rocket, Key, Lock, AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import analytics from '@/lib/posthog'

// Typed request interface (keep in sync with the backend)
import type { OnboardRequest } from '@/lib/types/api'

const OPENAI_KEY_REGEX = /^(sk-|sk-proj-)[A-Za-z0-9_-]{40,}$/
const ANTHROPIC_KEY_REGEX = /^sk-ant-/
const GOOGLE_KEY_REGEX = /^AI[a-zA-Z0-9_-]{35,39}$/

// Field-level error state
interface FieldErrors {
  fullName?: string
  openaiKey?: string
  anthropicKey?: string
  googleKey?: string
  referralCode?: string
  global?: string
}

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hasNameOnLoad, setHasNameOnLoad] = useState(false)
  const [statusCheckFailed, setStatusCheckFailed] = useState(false) // 🔧 HOTFIX: Prevent infinite retry loop
  const [isRedirecting, setIsRedirecting] = useState(false) // 🎨 VISIONARY: Track redirect state to prevent skeleton flash
  const [errors, setErrors] = useState<FieldErrors>({}) // Field errors
  
  const router = useRouter()
  const supabase = createClient()

  // 🛡️ CSRF COOKIE WARMER: Pre-fetch CSRF token before user submits form
  // This ensures the backend sets the csrf_token cookie BEFORE we make POST requests
  useEffect(() => {
    const warmCsrfCookie = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) return
      
      try {
        // Make lightweight GET request to any endpoint to trigger CSRF cookie generation
        // The middleware will see we don't have a csrf_token cookie and set one
        await fetch(`${apiUrl}/health`, {
          method: 'GET',
          credentials: 'include', // CRITICAL: Include credentials to receive cookies
        })
      } catch (error) {
        // Silently fail - this is just a warming request
        // If it fails, the CSRF middleware will still set the cookie on the actual POST
        if (process.env.NODE_ENV === 'development') {
          console.debug('CSRF cookie warmer request failed (non-critical):', error)
        }
      }
    }
    
    warmCsrfCookie()
  }, []) // Run once on mount

  useEffect(() => {
    // Track onboarding start
    if (typeof window !== 'undefined' && !(window as any).onboardingStartTime) {
      (window as any).onboardingStartTime = Date.now()
      analytics.onboardingStarted('direct')
    }
    
    const loadData = async () => {
      // 🔧 HOTFIX: Guard against infinite retry loop
      // If status check already failed (400/429), don't retry automatically
      if (statusCheckFailed) {
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        console.warn("⚠️ NEXT_PUBLIC_API_URL is not set! API calls will fail.")
      }
      
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push('/login')
        return
      }

      try {
        const res = await fetch(`${apiUrl}/management/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        })
        
        if (res.ok) {
          const status = await res.json()
          
          // 🎨 VISIONARY: Enforce immediate redirect if user is fully onboarded
          // This prevents users from seeing a completed onboarding skeleton
          if (status.onboarded === true) {
            if (process.env.NODE_ENV === 'development') {
              // User is onboarded, redirecting to dashboard
            }
            setIsRedirecting(true) // Prevent loading skeleton from showing
            // Use replace instead of push to prevent back button from returning to onboarding
            router.replace('/dashboard')
            return // CRITICAL: Exit immediately, don't continue with rest of function
          }
          
          // User is not onboarded, continue with form setup
          if (process.env.NODE_ENV === 'development') {
            // User not onboarded, showing onboarding form
          }
        } else {
          // 🔧 HOTFIX: Handle 400/429 errors - stop the loop
          if (res.status === 400 || res.status === 429) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`Status check failed with ${res.status}, stopping retry loop`)
            }
            setStatusCheckFailed(true)
            setLoading(false)
            return
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Status check failed, assuming not onboarded:', error)
        }
        // 🔧 HOTFIX: On any error, stop loading and prevent retries
        setStatusCheckFailed(true)
        setLoading(false)
        setUser(user)
        
        const metadata = user.user_metadata
        if (metadata?.full_name) {
          setFullName(metadata.full_name)
          setHasNameOnLoad(true)
        }
        return
      }

      // Only reach here if user is NOT onboarded
      // Set up form with user data
      setUser(user)
      
      const metadata = user.user_metadata
      if (metadata?.full_name) {
        setFullName(metadata.full_name)
        setHasNameOnLoad(true)
      }
      
      setLoading(false)
    }
    
    loadData()
    // 🔧 HOTFIX: Empty dependency array - only run ONCE on mount
  }, [])

  // Comprehensive validation function
  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {}

    // Validate full name
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters'
    }

    // Provider keys are all optional — a user can finish onboarding and add a
    // key later under Settings → Providers. Each key, if supplied, must match
    // the expected provider's format.
    const hasOpenAI = openaiKey.trim().length > 0
    const hasAnthropic = anthropicKey.trim().length > 0
    const hasGoogle = googleKey.trim().length > 0

    // Validate OpenAI key format (if provided)
    if (hasOpenAI && !OPENAI_KEY_REGEX.test(openaiKey.trim())) {
      newErrors.openaiKey = 'Invalid format. Key should start with "sk-" or "sk-proj-"'
    }

    // Validate Anthropic key format (if provided)
    if (hasAnthropic && !ANTHROPIC_KEY_REGEX.test(anthropicKey.trim())) {
      newErrors.anthropicKey = 'Invalid format. Key should start with "sk-ant-"'
    }

    // Validate Google key format (if provided)
    if (hasGoogle && !GOOGLE_KEY_REGEX.test(googleKey.trim())) {
      newErrors.googleKey = 'Invalid format. Google API keys start with "AI" followed by 35-39 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setErrors({})

    // Validate form
    if (!validateForm()) {
      // Global errors are now shown via persistent Alert component
      // No toast needed - user sees alert at top of form
      return
    }

    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session. Please log in again.')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not configured. Please contact the operator of this deployment.')
      }

      // Build typed request body
      const requestBody: OnboardRequest = {
        full_name: fullName.trim(),
        email: user?.email || '',
        openai_key: openaiKey.trim() || undefined,      // undefined if empty
        anthropic_key: anthropicKey.trim() || undefined, // Anthropic Claude
        google_key: googleKey.trim() || undefined,       // Google Gemini
        referral_code: referralCode.trim() || undefined  // Optional referral code
      }

      const res = await authenticatedFetch(
        `${apiUrl}/management/onboard`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000)
        },
        session.access_token
      )

      if (!res.ok) {
        const errorMsg = await handleApiError(res)
        
        // Parse backend validation errors
        if (res.status === 400) {
          if (errorMsg.toLowerCase().includes('openai')) {
            setErrors({ openaiKey: errorMsg })
          } else if (errorMsg.toLowerCase().includes('anthropic')) {
            setErrors({ anthropicKey: errorMsg })
          } else if (errorMsg.toLowerCase().includes('google') || errorMsg.toLowerCase().includes('gemini')) {
            setErrors({ googleKey: errorMsg })
          } else {
            toast.error(errorMsg)
          }
        } else {
          // Non-field errors (500, 503, etc.)
          toast.error(errorMsg)
        }
        return
      }

      // Success - no toast, just redirect
      router.push('/dashboard')

    } catch (error: unknown) {
      toast.error(safeErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  // 🎨 VISIONARY: Don't show loading skeleton if we're redirecting
  // This prevents flash of onboarding form before redirect completes
  if (loading || isRedirecting) {
      return (
        <div className="min-h-screen bg-slate-50">
            <Header user={null} title="Setup" />
            <main className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 73px)' }}>
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader className="space-y-4">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </main>
        </div>
      )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-violet-50/30 to-blue-50">
      <Header user={user} title="Setup" />

      <main className="flex flex-col items-center justify-center p-4 py-12" style={{ minHeight: 'calc(100vh - 73px)' }}>
        
        {/* Welcome Section */}
        <div className="mb-8 text-center max-w-2xl">
          <div className="flex justify-center mb-4">
            <div className="bg-linear-to-br from-violet-600 to-blue-600 h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Rocket className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-display font-bold bg-linear-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-3">
            Welcome to Oxy Engine
          </h1>
          <p className="text-slate-600 text-lg mb-4">
            Self-hosted AI control plane. Get started in 3 steps.
          </p>
          
          {/* Visual Steps - Gradient Premium */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-2">
              <div className="bg-violet-100 text-violet-700 font-bold h-8 w-8 rounded-full flex items-center justify-center text-sm">
                1
              </div>
              <span className="text-sm text-slate-700 font-medium">Enter name</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 text-blue-700 font-bold h-8 w-8 rounded-full flex items-center justify-center text-sm">
                2
              </div>
              <span className="text-sm text-slate-700 font-medium">Add provider key</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <div className="bg-cyan-100 text-cyan-700 font-bold h-8 w-8 rounded-full flex items-center justify-center text-sm">
                3
              </div>
              <span className="text-sm text-slate-700 font-medium">Start building</span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="w-full max-w-2xl shadow-xl border-2">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-slate-900">Complete Your Setup</CardTitle>
            <CardDescription className="text-slate-600">
              Configure your profile and connect <strong className="text-slate-900">at least one AI provider</strong> to get started.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* noValidate to prevent HTML5 validation */}
            <form onSubmit={onSubmit} noValidate className="space-y-6">
              
              {/* Global Error Alert */}
              {errors.global && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{errors.global}</p>
                </div>
              )}

              {/* Full Name Field */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    // Clear error on change
                    if (errors.fullName) {
                      setErrors(prev => ({ ...prev, fullName: undefined }))
                    }
                  }}
                  placeholder="John Doe"
                  autoComplete="name"
                  className={`text-sm ${errors.fullName ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={submitting}
                />
                {/* Field-specific error */}
                {errors.fullName && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.fullName}
                  </p>
                )}
              </div>

              {/* OpenAI API Key Field */}
              <div className="space-y-2">
                <Label htmlFor="openaiKey" className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  OpenAI API Key <span className="text-slate-500 text-xs font-normal">(starts with sk-proj-...)</span>
                </Label>
                
                {/* Help Section - Gradient Premium */}
                <div className="bg-linear-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="bg-blue-100 rounded-full p-1 shrink-0 mt-0.5">
                      <ExternalLink className="h-3 w-3 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>Get your OpenAI key:</strong> Visit{' '}
                        <a 
                          href="https://platform.openai.com/api-keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-blue-900 font-medium inline-flex items-center gap-1"
                        >
                          platform.openai.com/api-keys
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
                
                <Input
                  id="openaiKey"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => {
                    setOpenaiKey(e.target.value)
                    // Clear errors on change
                    if (errors.openaiKey || errors.global) {
                      setErrors(prev => ({ ...prev, openaiKey: undefined, global: undefined }))
                    }
                  }}
                  placeholder="sk-proj-ABCDefghijKLMnop123456789..."
                  autoComplete="off"
                  className={`h-12 font-mono text-base ${errors.openaiKey ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={submitting}
                  aria-label="Your OpenAI API key for making AI requests"
                />
                {/* Field-specific error */}
                {errors.openaiKey && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.openaiKey}
                  </p>
                )}
              </div>

              {/* Anthropic API Key Field */}
              <div className="space-y-2">
                <Label htmlFor="anthropicKey" className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Anthropic API Key <span className="text-slate-500 text-xs font-normal">(starts with sk-ant-...)</span>
                </Label>
                
                {/* Help Section - Gradient Premium */}
                <div className="bg-linear-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="bg-blue-100 rounded-full p-1 shrink-0 mt-0.5">
                      <ExternalLink className="h-3 w-3 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>Enable Claude models:</strong> Get your key at{' '}
                        <a 
                          href="https://console.anthropic.com/settings/keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-blue-900 font-medium inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          console.anthropic.com/settings/keys
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
                
                <Input
                  id="anthropicKey"
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => {
                    setAnthropicKey(e.target.value)
                    // Clear errors on change
                    if (errors.anthropicKey || errors.global) {
                      setErrors(prev => ({ ...prev, anthropicKey: undefined, global: undefined }))
                    }
                  }}
                  placeholder="sk-ant-api03-..."
                  autoComplete="off"
                  className={`font-mono text-sm ${errors.anthropicKey ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={submitting}
                />
                {/* Field-specific error */}
                {errors.anthropicKey && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.anthropicKey}
                  </p>
                )}
              </div>

              {/* Google Gemini API Key Field */}
              <div className="space-y-2">
                <Label htmlFor="googleKey" className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Google Gemini API Key <span className="text-slate-500 text-xs font-normal">(starts with AIza...)</span>
                </Label>
                
                {/* Help Section */}
                <div className="bg-linear-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="bg-orange-100 rounded-full p-1 shrink-0 mt-0.5">
                      <ExternalLink className="h-3 w-3 text-orange-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-orange-800 leading-relaxed">
                        <strong>Enable Gemini models:</strong> Get your key at{' '}
                        <a 
                          href="https://aistudio.google.com/app/api-keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-orange-900 font-medium inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          https://aistudio.google.com/app/api-keys
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
                
                <Input
                  id="googleKey"
                  type="password"
                  value={googleKey}
                  onChange={(e) => {
                    setGoogleKey(e.target.value)
                    // Clear errors on change
                    if (errors.googleKey || errors.global) {
                      setErrors(prev => ({ ...prev, googleKey: undefined, global: undefined }))
                    }
                  }}
                  placeholder="AIzaSyABC1234567890-XYZ_example_key..."
                  autoComplete="off"
                  className={`font-mono text-sm ${errors.googleKey ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={submitting}
                />
                {/* Field-specific error */}
                {errors.googleKey && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.googleKey}
                  </p>
                )}
              </div>

              {/* Referral Code Field */}
              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-sm font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Referral Code <span className="text-slate-500 text-xs font-normal">(Optional)</span>
                </Label>
                
                {/* Help Section */}
                <div className="bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="bg-green-100 rounded-full p-1 shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-green-800 leading-relaxed">
                        <strong>Have a referral code?</strong> Enter it to apply referral credits. Format: <code className="bg-green-100 px-1 py-0.5 rounded text-green-900 font-mono">OXY-XXXXX</code>
                      </p>
                    </div>
                  </div>
                </div>
                
                <Input
                  id="referralCode"
                  type="text"
                  value={referralCode}
                  onChange={(e) => {
                    // Auto-format to uppercase
                    const formatted = e.target.value.toUpperCase().trim()
                    setReferralCode(formatted)
                    // Clear errors on change
                    if (errors.referralCode) {
                      setErrors(prev => ({ ...prev, referralCode: undefined }))
                    }
                  }}
                  placeholder="OXY-A7F2X"
                  autoComplete="off"
                  className={`font-mono text-sm uppercase ${errors.referralCode ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={submitting}
                  maxLength={9}
                  aria-label="Optional referral code from a friend (OXY-XXXXX format)"
                />
                {/* Field-specific error */}
                {errors.referralCode && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.referralCode}
                  </p>
                )}
                {/* Success hint if valid format */}
                {referralCode.trim().length === 9 && referralCode.startsWith('OXY-') && !errors.referralCode && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Valid format. The referral credit is applied after signup.
                  </p>
                )}
              </div>

              {/* Enterprise Security Badge */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 rounded-full p-2">
                    <Lock className="h-5 w-5 text-green-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                      Security
                      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Open source
                      </Badge>
                      <a 
                        href="https://github.com/heyvaldemar/oxy-llm-gateway/blob/main/SECURITY.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-700 hover:text-green-900 underline inline-flex items-center gap-1"
                        title="View security documentation"
                      >
                        View Policy
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Provider keys encrypted at rest • Privacy modes for prompt logging • Code you can audit
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button - Gradient Premium */}
              <Button 
                type="submit" 
                className="w-full bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold py-6 text-base shadow-lg shadow-violet-500/25"
                disabled={submitting}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Setting up your account...</span>
                  </div>
                ) : (
                  <span>Complete Setup →</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="mt-8 max-w-2xl w-full">
          <details className="group bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <summary className="cursor-pointer text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium flex items-center gap-2 p-4 transition-colors">
              <span className="group-open:rotate-90 transition-transform text-violet-600">▶</span>
              How does Oxy Engine work?
            </summary>
            <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed">
                Oxy Engine acts as a unified control plane between your apps and <strong>all major AI providers (OpenAI, Claude, etc.)</strong> Your keys are encrypted and stored securely in our Vault. We add <strong>hard budget controls</strong>, <strong>secret threat detection (DLP)</strong>, and audit-ready usage analytics on top.
              </p>
            </div>
          </details>
        </div>
      </main>
    </div>
  )
}
