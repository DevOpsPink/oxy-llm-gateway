"use client"

/**
 * SSO CONFIGURATION PANEL
 * =======================
 * 
 * Allows organization owners/admins to configure SSO for their domain.
 * 
 * Requirements:
 * - Organization plan_tier must be "enterprise" (set by the operator)
 * - User must be owner or admin
 * - Domain must be unique (verified by backend)
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Building2, Shield, CheckCircle2, AlertTriangle, ExternalLink, Crown } from 'lucide-react'

interface SSOConfigPanelProps {
  organizationId: string
}

export function SSOConfigPanel({ organizationId }: SSOConfigPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [domain, setDomain] = useState('')
  const [providerId, setProviderId] = useState('')
  
  const supabase = createClient()

  useEffect(() => {
    loadSSOStatus()
  }, [organizationId])

  async function loadSSOStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/sso/status/${organizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (!res.ok) {
        throw new Error('Failed to load SSO status')
      }

      const data = await res.json()
      setStatus(data)

      // Pre-fill domain if already configured
      if (data.sso_domain) {
        setDomain(data.sso_domain)
      }
    } catch (error: any) {
      toast.error('Failed to load SSO status', {
        description: error.message
      })
    }
  }

  async function handleConfigureSSO() {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Not authenticated')
        return
      }

      // First, create SSO provider in Supabase (if not already created)
      // Note: In production, this would be done via Supabase Dashboard
      // For now, we'll use a placeholder provider ID
      const tempProviderId = providerId || `saml-${domain.replace(/\./g, '-')}`

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sso/configure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: domain,
          provider_id: tempProviderId
        })
      })

      const data = await res.json()

      if (!res.ok) {
        // Handle specific error cases
        if (res.status === 402) {
          toast.error('Enterprise plan tier required', {
            description: 'SSO is enabled for orgs on the enterprise plan tier. The operator sets the tier in the database.',
            action: {
              label: 'Plan limits',
              onClick: () => router.push('/pricing')
            }
          })
          return
        } else if (res.status === 409) {
          toast.error('Domain already claimed', {
            description: 'This domain is already configured for another organization'
          })
          return
        } else {
          throw new Error(data.detail || 'Configuration failed')
        }
      }

      toast.success('SSO configured successfully!', {
        description: 'Domain verification is required before activation.'
      })

      // Reload status
      await loadSSOStatus()
    } catch (error: any) {
      toast.error('Failed to configure SSO', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  // If not on Enterprise plan
  if (status && !status.can_configure_sso) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Enterprise SSO
              </CardTitle>
              <CardDescription>
                Single Sign-On with Okta, Azure AD, Google Workspace
              </CardDescription>
            </div>
            <Badge className="bg-purple-600">
              <Crown className="h-3 w-3 mr-1" />
              Enterprise
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              SSO is enabled for orgs on the enterprise plan tier. Ask the operator of this
              deployment to set your org&apos;s plan_tier to enterprise.
            </AlertDescription>
          </Alert>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Centralized authentication</div>
                <div className="text-sm text-slate-600">
                  Manage access through your identity provider
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Enhanced security</div>
                <div className="text-sm text-slate-600">
                  Enforce MFA, password policies, and session controls
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Automatic provisioning</div>
                <div className="text-sm text-slate-600">
                  Users are automatically added to your organization
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            onClick={() => router.push('/pricing')}
            className="w-full"
            size="lg"
          >
            <Crown className="h-4 w-4 mr-2" />
            View plan limits
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // If SSO is already configured
  if (status?.sso_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            SSO Configured
          </CardTitle>
          <CardDescription>
            Your organization uses single sign-on
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-green-900">SSO Active</div>
                <div className="text-sm text-green-700 mt-1">
                  Domain: <code className="font-mono">{status.sso_domain}</code>
                </div>
                {status.sso_domain_verified ? (
                  <Badge variant="outline" className="mt-2 bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Domain Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mt-2 bg-amber-100 text-amber-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Verification Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!status.sso_domain_verified && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Domain verification required. Ask the operator of this deployment to complete verification.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-slate-600">
            Configured on {new Date(status.sso_configured_at).toLocaleDateString()}
          </div>
        </CardContent>

        <CardFooter>
          <Button
            variant="outline"
            onClick={() => window.open('/docs/features/sso', '_blank')}
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Get SSO Help
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Configuration form (not yet configured)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Configure SSO
        </CardTitle>
        <CardDescription>
          Enable single sign-on for your organization
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            After configuration, all users with your domain will automatically join your organization when they sign in via SSO.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="domain">Company Domain</Label>
          <Input
            id="domain"
            type="text"
            placeholder="company.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value.toLowerCase())}
            disabled={loading}
          />
          <div className="text-xs text-slate-500">
            All users with @{domain || 'company.com'} emails will be able to sign in via SSO
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider">SSO Provider ID (Optional)</Label>
          <Input
            id="provider"
            type="text"
            placeholder="Leave blank for auto-configuration"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            disabled={loading}
          />
          <div className="text-xs text-slate-500">
            If you've already configured SAML in Supabase, enter the provider ID here
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Next Steps:</strong> After submitting, you'll need to:
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Verify domain ownership (email verification)</li>
              <li>Configure SAML settings in Supabase Dashboard</li>
              <li>Test SSO login with a test account</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleConfigureSSO}
          disabled={loading || !domain}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Configuring...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Configure SSO
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

