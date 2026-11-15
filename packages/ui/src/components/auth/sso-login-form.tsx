"use client"

/**
 * SSO LOGIN FORM
 * ==============
 * 
 * Magic UX:
 * 1. User types email → We detect domain
 * 2. If domain has SSO → Show "Sign in with SSO" button
 * 3. If no SSO → Show password field (normal flow)
 * 
 * Security:
 * - Domain lookup is rate-limited (10 req/min)
 * - SSO redirect is handled by Supabase Auth
 * - Auto-join users to organization after login
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, Shield, ArrowRight, CheckCircle2 } from 'lucide-react'

interface SSOLoginFormProps {
  onSuccess?: (organizationId: string, organizationName: string) => void
  onPasswordMode?: () => void
}

export function SSOLoginForm({ onSuccess, onPasswordMode }: SSOLoginFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [ssoAvailable, setSsoAvailable] = useState(false)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [ssoProviderId, setSsoProviderId] = useState<string | null>(null)
  
  const supabase = createClient()

  async function checkSSOAvailability(emailAddress: string) {
    try {
      setChecking(true)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sso/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailAddress })
      })

      if (!res.ok) {
        // SSO not configured for this domain - this is expected for most users
        setSsoAvailable(false)
        return
      }

      const data = await res.json()

      if (data.sso_available) {
        setSsoAvailable(true)
        setOrganizationName(data.organization_name)
        setSsoProviderId(data.sso_provider_id)
      } else {
        setSsoAvailable(false)
        setOrganizationName(null)
        setSsoProviderId(null)
      }
    } catch (error) {
      // Network error or API unavailable - fail silently, user can still use email login
      if (process.env.NODE_ENV === 'development') {
        console.info('[SSO] Lookup unavailable (expected if backend not running):', error)
      }
      setSsoAvailable(false)
    } finally {
      setChecking(false)
    }
  }

  // Debounced SSO domain lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && email.includes('@')) {
        checkSSOAvailability(email)
      } else {
        setSsoAvailable(false)
        setOrganizationName(null)
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [email])


  async function handleSSOLogin() {
    if (!ssoProviderId || !email) return

    try {
      setLoading(true)

      // Supabase Auth SSO flow
      const { data, error } = await supabase.auth.signInWithSSO({
        domain: email.split('@')[1],
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (error) {
        throw error
      }

      // Redirect to IdP (Okta/Azure AD/etc)
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (error: any) {
      toast.error('SSO login failed', {
        description: error.message || 'Please try again or contact your administrator.'
      })
      setLoading(false)
    }
  }

  function handlePasswordMode() {
    if (onPasswordMode) {
      onPasswordMode()
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Enterprise Sign In
        </CardTitle>
        <CardDescription className="whitespace-nowrap">
          Sign in with your work email to access your organization
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        {/* Email Input */}
        <div className="space-y-2">
          <Label htmlFor="email">Work Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="alice@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="text-base"
            autoComplete="email"
            autoFocus
          />
        </div>

        {/* SSO Availability Indicator */}
        {checking && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            Checking SSO availability...
          </div>
        )}

        {ssoAvailable && organizationName && !checking && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-green-900">SSO Available</div>
                <div className="text-sm text-green-700 mt-1">
                  Sign in with your {organizationName} account using single sign-on
                </div>
              </div>
            </div>
          </div>
        )}

        {!ssoAvailable && email.includes('@') && !checking && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-sm text-slate-600 text-center">
              No SSO configured for this domain.<br />
              You can sign in with a password instead.
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-2">
        {ssoAvailable ? (
          <>
            {/* SSO Sign In Button */}
            <Button
              onClick={handleSSOLogin}
              disabled={loading || !email}
              className="w-full bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200 hover:-translate-y-0.5 rounded-xl disabled:from-violet-400 disabled:to-blue-400 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Redirecting to SSO...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Sign in with SSO
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            {/* Fallback to Password */}
            <Button
              variant="ghost"
              onClick={handlePasswordMode}
              disabled={loading}
              className="w-full"
            >
              Sign in with password instead
            </Button>
          </>
        ) : (
          <>
            {/* Password Sign In (Normal Flow) */}
            <Button
              onClick={handlePasswordMode}
              disabled={loading || !email.includes('@')}
              className="w-full bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200 hover:-translate-y-0.5 rounded-xl disabled:from-violet-400 disabled:to-blue-400 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              size="lg"
            >
              Continue with Email
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {/* Enterprise Badge */}
        {ssoAvailable && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Enterprise Organization
            </Badge>
          </div>
        )}
      </CardFooter>

      {/* Security Note - Only show for SSO users */}
      {ssoAvailable && (
        <div className="px-6 pb-6">
          <div className="text-xs text-slate-500 text-center">
            Your organization uses SSO.<br />
            You'll be redirected to your identity provider.
          </div>
        </div>
      )}
    </Card>
  )
}

