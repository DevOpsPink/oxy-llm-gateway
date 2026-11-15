'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

type BillingOverview = {
  plan: string
  free_plan_limit_per_month?: number | null
  free_plan_usage_this_month?: number | null
  referral_code?: string | null
  referral_credits_usd?: number
  next_reset_at?: string | null
}

export default function BillingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<BillingOverview | null>(null)
  const [copied, setCopied] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setToken(data.session?.access_token || null))
      .catch(() => setToken(null))
  }, [supabase])

  const fetchOverview = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/billing/overview`, {}, token)
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
    fetchOverview()
  }, [fetchOverview])

  const copyReferral = () => {
    if (!data?.referral_code) return
    const link = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/?ref=${data.referral_code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const renderUsage = () => {
    if (!data) return null
    const used = data.free_plan_usage_this_month || 0
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Requests this month (no quota; budgets cap spend).</p>
        <p className="text-sm font-medium">{used.toLocaleString()}</p>
      </div>
    )
  }

  const renderReferral = () => {
    const code = data?.referral_code || '—'
    const credits = data?.referral_credits_usd ?? 0
    const link = data?.referral_code
      ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}/?ref=${data.referral_code}`
      : '—'
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Share this link. Eligible referrals grant usage credits to your org (non-cash, non-transferable; applied to usage before billing).
          </p>
          <div className="flex gap-2 items-center">
            <Input value={link} readOnly className="text-sm" />
            <Button variant="outline" size="icon" onClick={copyReferral} disabled={!data?.referral_code} aria-label="Copy referral link">
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {copied && <p className="text-xs text-green-600">Copied!</p>}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Referral code</p>
            <p className="text-sm text-muted-foreground">{code}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">Referral credits</p>
            <p className="text-lg font-semibold">${credits.toFixed(2)}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      )
    }
    if (error) {
      return <p className="text-sm text-red-600">Could not load billing overview: {error}</p>
    }
    if (!data) {
      return <p className="text-sm text-muted-foreground">No billing data yet.</p>
    }
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan &amp; Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Current plan: <span className="font-semibold capitalize">{data.plan}</span>
            </p>
            {renderUsage()}
            {data.plan === 'free' && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold">Change plan</h3>
                <p className="text-sm text-muted-foreground">
                  Plan tiers are quota levels. When the operator has configured Stripe, the org can move to the Growth tier
                  through Stripe Checkout; otherwise the operator sets the tier in the database.
                </p>
                <Button
                  onClick={async () => {
                    if (!token) return
                    setCheckoutLoading(true)
                    setCheckoutError(null)
                    try {
                      const res = await authenticatedFetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/billing/create-checkout-session`,
                        {
                          method: 'POST',
                          body: JSON.stringify({ plan: 'growth', interval: 'month' }),
                        },
                        token
                      )
                      if (!res.ok) throw new Error(await handleApiError(res))
                      const json = await res.json()
                      window.location.href = json.checkout_url
                    } catch (err) {
                      setCheckoutError(safeErrorMessage(err))
                    } finally {
                      setCheckoutLoading(false)
                    }
                  }}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? 'Redirecting…' : 'Change plan via Stripe'}
                </Button>
                {checkoutError && <p className="text-sm text-red-600">{checkoutError}</p>}
              </div>
            )}
            {data.plan !== 'free' && (
              <p className="text-sm text-muted-foreground">
                Your org is on the {data.plan} plan. Plan tiers are managed by the operator of this deployment.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Referrals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">{renderReferral()}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Free plan overview, monthly usage, and referral credits.
          </p>
        </div>
        {renderContent()}
      </main>
    </div>
  )
}

