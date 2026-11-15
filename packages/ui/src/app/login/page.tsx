'use client'

/**
 * Login page — magic-link auth via GoTrue, plus an SSO entry point.
 *
 * Light theme to match the landing. No trust badges (no "SOC 2 ready"
 * because no certification exists) and no plan-cap promises (the cap is
 * a policy value the operator sets).
 */

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Mail,
  RefreshCw,
  AlertCircle,
  Building2,
  Server,
  ArrowRight,
  Github,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const REPO_URL = 'https://github.com/heyvaldemar/oxy-llm-gateway'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loginMode, setLoginMode] = useState<'email' | 'sso'>('email')

  useEffect(() => {
    setIsMounted(true)

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/dashboard')
    }
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) router.push('/dashboard')
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [resendCooldown])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      })
      if (signInError) throw signInError
      setEmailSent(true)
      setSentEmail(email.trim().toLowerCase())
      setResendCooldown(60)
    } catch (err: unknown) {
      console.error('Login error:', err)
      const errorObj = err as { message?: string }
      let errorMessage = 'Failed to send magic link. Please try again.'
      if (errorObj.message?.includes('rate limit')) {
        errorMessage = 'Too many attempts. Please wait a moment and try again.'
      } else if (errorObj.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (errorObj.message) {
        errorMessage = errorObj.message
      }
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async () => {
    if (!sentEmail || isResending || resendCooldown > 0) return
    setIsResending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: sentEmail,
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      })
      if (error) throw error
      setResendCooldown(60)
    } catch (err: unknown) {
      console.error('Resend error:', err)
      const errorObj = err as { message?: string }
      const errorMessage =
        errorObj.message?.includes('rate limit')
          ? 'Please wait a moment before requesting another link.'
          : 'Failed to resend link. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsResending(false)
    }
  }

  if (!isMounted) return null

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Server className="h-5 w-5 text-violet-600" />
            <span className="font-semibold tracking-tight">Oxy</span>
          </Link>
          <Link
            href={REPO_URL}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <Github className="h-4 w-4" />
            GitHub
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 mb-2">
              {emailSent ? 'Check your email' : 'Sign in to Oxy'}
            </h1>
            <p className="text-slate-600 text-sm">
              {emailSent
                ? <>We sent a magic link to <span className="font-medium text-slate-900">{sentEmail}</span></>
                : 'Magic-link sign-in via GoTrue. New here? Just enter your email — we will create the account.'}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-7">
            {emailSent ? (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="h-14 w-14 rounded-full bg-violet-100 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-violet-600" />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm text-slate-700">
                    Click the link in your email to sign in.
                  </p>
                  <p className="text-xs text-slate-500">
                    Link expires in 24 hours.
                  </p>
                </div>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isResending || resendCooldown > 0}
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Resending…
                    </>
                  ) : resendCooldown > 0 ? (
                    <>Resend in {resendCooldown}s</>
                  ) : (
                    <>Didn&apos;t receive it? Resend</>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setEmailSent(false)
                    setEmail('')
                    setSentEmail('')
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Mode Toggle */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLoginMode('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                      loginMode === 'email'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode('sso')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                      loginMode === 'sso'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    SSO
                  </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                      {loginMode === 'email' ? 'Email address' : 'Work email'}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={loginMode === 'email' ? 'you@example.com' : 'you@company.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      autoComplete="email"
                      autoFocus
                      className="h-11"
                      required
                    />

                    {error && (
                      <div className="flex items-start gap-2 text-red-600 text-sm pt-1">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending…</span>
                      </div>
                    ) : loginMode === 'sso' ? (
                      <>Continue with SSO</>
                    ) : (
                      <>
                        Send magic link
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {loginMode === 'sso' && (
                  <p className="text-xs text-slate-500 text-center">
                    SSO requires the sso add-on to be enabled for the organization. See{' '}
                    <Link
                      href={`${REPO_URL}/blob/main/docs/features/add-ons.md`}
                      className="text-violet-600 hover:underline"
                    >
                      docs/features/add-ons.md
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Honest sub-card line */}
          <p className="mt-6 text-xs text-slate-500 text-center">
            Self-hosted · Apache License 2.0 ·{' '}
            <Link href="/about" className="text-violet-600 hover:underline">
              About the maintainers
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200">
        <div className="container mx-auto px-6 py-5">
          <p className="text-xs text-slate-500 text-center">
            By signing in, you agree to the{' '}
            <Link href="/terms" className="hover:text-slate-900 underline-offset-2 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:text-slate-900 underline-offset-2 hover:underline">
              Privacy notes
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
