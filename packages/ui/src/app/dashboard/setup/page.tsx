'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type Step = {
  id: string
  label: string
  completed: boolean
  optional?: boolean
  details?: Record<string, any>
}

type SetupStatus = {
  completed: boolean
  steps: Step[]
  incomplete_required_steps: string[]
}

const stepLinks: Record<string, string> = {
  providers: '/dashboard/requests', // placeholder; no provider page yet
  guardrails: '/dashboard/guardrails',
  privacy: '/dashboard/privacy',
  billing: '/dashboard/billing',
  sso: '/dashboard/sso',
}

const descriptions: Record<string, string> = {
  providers: 'Connect at least one provider (OpenAI, Anthropic, Google) or a local model.',
  guardrails: 'Enable kill switch / auto-suspend to protect against runaway costs.',
  privacy: 'Choose privacy mode and set log retention.',
  billing: 'Pick a plan and add payment details if needed.',
  sso: 'Optional: enable SSO so your team can sign in via your IdP.',
}

export default function SetupPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SetupStatus | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const fetchStatus = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/setup/status`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setStatus(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const renderSteps = () => {
    if (loading) {
      return <Skeleton className="h-64 w-full" />
    }
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not load setup status. <button className="underline" onClick={fetchStatus}>Retry</button>
        </div>
      )
    }
    if (!status) return null

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {status.steps.map((step) => {
          const completed = step.completed
          const optional = step.optional
          return (
            <Card key={step.id}>
              <CardHeader className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{step.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{descriptions[step.id] || ''}</p>
                </div>
                <Badge variant={completed ? 'secondary' : optional ? 'outline' : 'destructive'}>
                  {completed ? 'Completed' : optional ? 'Optional' : 'Required'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {step.details && (
                  <div className="text-xs text-muted-foreground break-words">
                    {Object.entries(step.details)
                      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="font-medium">{k}</span>
                          <span>{String(v)}</span>
                        </div>
                      ))}
                  </div>
                )}
                {!completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const href = stepLinks[step.id] || '/dashboard'
                      window.location.href = href
                    }}
                  >
                    Go to settings
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Setup Wizard" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Setup Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Setup checklist for an Oxy gateway. Advisory only — not an SLA or enforcement mechanism.
          </p>
          {status?.completed && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              Your organization is fully configured. You can still adjust settings below.
            </div>
          )}
          {!status?.completed && status && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {status.incomplete_required_steps.length} steps remaining.
            </div>
          )}
        </div>
        {renderSteps()}
      </main>
    </div>
  )
}

