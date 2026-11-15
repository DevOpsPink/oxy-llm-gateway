/**
 * SUBSCRIPTION HOOK
 * =================
 * React hook for the optional Stripe billing module.
 * 
 * Features:
 * - Fetch subscription status
 * - Create checkout session (change plan tier via Stripe)
 * - Cancel subscription
 * - Reactivate subscription
 * - Real-time usage tracking
 * 
 * Usage:
 * ```tsx
 * const { subscription, loading, checkout, cancel, reactivate } = useSubscription()
 * 
 * if (subscription?.has_subscription) {
 *   return <div>Plan: {subscription.plan_tier}</div>
 * }
 * 
 * return <Button onClick={() => checkout('starter')}>Switch to Starter</Button>
 * ```
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

/**
 * Keep in sync with the backend SubscriptionStatusResponse
 * Backend: packages/engine/routes/billing.py:SubscriptionStatusResponse
 * 
 * Fields:
 * - has_subscription: bool
 * - plan_tier: Optional[str] - 'free' | 'starter' | 'growth' | 'business' | 'enterprise'
 * - status: Optional[str] - 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
 * - requests_used: Optional[int]
 * - requests_limit: Optional[int]
 * - usage_percentage: Optional[float]
 * - current_period_end: Optional[str] (ISO 8601)
 * - cancel_at_period_end: bool (default: false)
 * - trial_end: Optional[str] (ISO 8601)
 * - billing_interval: Optional[str] - 'month' | 'year'
 */
/** Plan tiers are quota levels; paid tiers are the ones Stripe Checkout can assign. */
export type PlanTier = 'free' | 'starter' | 'growth' | 'business' | 'enterprise'
export type PaidPlanTier = Exclude<PlanTier, 'free'>

export interface SubscriptionStatus {
  has_subscription: boolean
  plan_tier: PlanTier | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | null
  requests_used: number | null
  requests_limit: number | null
  usage_percentage: number | null
  current_period_end: string | null
  
  // Subscription lifecycle fields
  cancel_at_period_end: boolean  // True if subscription will cancel at period end
  trial_end: string | null  // ISO 8601 datetime (null if not in trial)
  billing_interval: 'month' | 'year' | null  // Current billing cycle
}

export type BillingInterval = 'month' | 'year'

export interface UseSubscriptionReturn {
  subscription: SubscriptionStatus | null
  loading: boolean
  error: string | null
  checkout: (plan: PaidPlanTier, interval?: BillingInterval) => Promise<void>
  cancel: () => Promise<void>
  reactivate: () => Promise<void>
  refresh: () => Promise<void>
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch subscription status
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/billing/status')

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch subscription status')
      }

      const data = await response.json()
      setSubscription(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Subscription fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Start Stripe Checkout for a plan tier (monthly or yearly billing)
  const checkout = useCallback(async (
    plan: PaidPlanTier,
    interval: BillingInterval = 'month'
  ) => {
    try {
      toast.loading('Creating checkout session...')

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { checkout_url } = await response.json()

      toast.success('Redirecting to checkout...')

      // Redirect to Stripe Checkout
      window.location.href = checkout_url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Checkout failed: ${message}`)
      console.error('Checkout error:', err)
    }
  }, [])

  // Cancel subscription at end of period
  const cancel = useCallback(async () => {
    try {
      toast.loading('Canceling subscription...')

      const response = await fetch('/api/billing/cancel', {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      const { message } = await response.json()

      toast.success(message || 'Subscription will cancel at end of billing period')

      // Refresh status
      await fetchStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Cancellation failed: ${message}`)
      console.error('Cancel error:', err)
    }
  }, [fetchStatus])

  // Reactivate scheduled cancellation
  const reactivate = useCallback(async () => {
    try {
      toast.loading('Reactivating subscription...')

      const response = await fetch('/api/billing/reactivate', {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reactivate subscription')
      }

      const { message } = await response.json()

      toast.success(message || 'Subscription reactivated')

      // Refresh status
      await fetchStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Reactivation failed: ${message}`)
      console.error('Reactivate error:', err)
    }
  }, [fetchStatus])

  // Fetch on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
    subscription,
    loading,
    error,
    checkout,
    cancel,
    reactivate,
    refresh: fetchStatus
  }
}

