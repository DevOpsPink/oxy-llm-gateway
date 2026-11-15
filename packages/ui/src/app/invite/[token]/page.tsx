'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Header } from "@/components/header"
import { CheckCircle2, XCircle, Loader2, Users, Building2 } from 'lucide-react'
import { authenticatedFetch, handleApiError } from '@/lib/api'

export default function InviteAcceptPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const token = params.token as string
  
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [organizationName, setOrganizationName] = useState<string>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Redirect to login with return URL
        router.push(`/login?redirect=/invite/${token}`)
        return
      }
      setIsAuthenticated(true)
      setLoading(false)
    }
    
    checkAuth()
  }, [token, router, supabase.auth])

  const handleAcceptInvite = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/invite/${token}`)
      return
    }

    setAccepting(true)
    setError(null)

    try {
      // Get session for authenticated request
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Session expired. Please log in again.')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('API URL not configured')
      }

      const res = await authenticatedFetch(
        `${apiUrl}/management/team/invite/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ invite_token: token })
        },
        session.access_token
      )

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to accept invitation')
      }

      const data = await res.json()
      setOrganizationName(data.organization_name)
      setSuccess(true)

      toast.success('Invitation accepted!', {
        description: `You've joined ${data.organization_name}`
      })

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (error: any) {
      const errorMsg = error.message || 'Failed to accept invitation'
      setError(errorMsg)
      
      toast.error('Failed to accept invitation', {
        description: errorMsg
      })
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="container max-w-2xl mx-auto px-4 py-16">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (success) {
    return (
      <>
        <Header />
        <div className="container max-w-2xl mx-auto px-4 py-16">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <CardTitle className="text-green-900">Invitation Accepted!</CardTitle>
                  <CardDescription className="text-green-700">
                    You've successfully joined {organizationName}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <div className="flex items-start gap-4">
                  <Building2 className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Welcome to the team!</h3>
                    <p className="text-gray-600 text-sm">
                      You now have access to {organizationName}'s projects, API keys, and usage analytics.
                      Redirecting you to the dashboard...
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="container max-w-2xl mx-auto px-4 py-16">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <CardTitle className="text-red-900">Invitation Error</CardTitle>
                  <CardDescription className="text-red-700">
                    Unable to accept this invitation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white rounded-lg p-6 border border-red-200">
                <p className="text-gray-900 font-medium mb-2">What went wrong?</p>
                <p className="text-gray-600 text-sm mb-4">{error}</p>
                
                <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">Common reasons:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>The invitation has expired (invites expire after 48 hours)</li>
                    <li>The invitation has already been accepted</li>
                    <li>The invitation was revoked by the organization owner</li>
                    <li>You're already a member of this organization</li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="flex-1"
              >
                Go to Dashboard
              </Button>
              <Button 
                onClick={() => router.push('/')}
                className="flex-1"
              >
                Back to home
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle>You've Been Invited!</CardTitle>
                <CardDescription>
                  Accept this invitation to join a team on Oxy Engine
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-3">What you'll get access to:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Shared Projects:</strong> Access to team projects and API keys</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Usage Analytics:</strong> View real-time request logs and spending</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Budget Controls:</strong> Monitor and manage team spending limits</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Collaboration Tools:</strong> Work together with your team seamlessly</span>
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 flex items-start gap-3">
              <div className="text-amber-600 text-xl">⏰</div>
              <div>
                <p className="text-sm text-amber-900 font-medium">This invitation expires in 48 hours</p>
                <p className="text-xs text-amber-700 mt-1">Accept it now to join the team</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={handleAcceptInvite}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting Invitation...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full"
              disabled={accepting}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}

