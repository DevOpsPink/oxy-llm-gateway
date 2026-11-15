'use client'

/**
 * OXY ENGINE - SUBSCRIPTION STATUS COMPONENT
 * ==========================================
 * 
 * Displays the org's plan tier, usage meters, and (with the optional Stripe
 * module) subscription management.
 * 
 * Features:
 * - Real-time usage tracking
 * - Visual usage meters with color-coded warnings
 * - Subscription management (change plan, cancel, reactivate)
 * - Billing period display
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch } from '@/lib/api'
import './subscription-status.css'

interface SubscriptionData {
  has_subscription: boolean
  plan_tier?: string
  status?: string
  requests_used?: number
  requests_limit?: number | null
  usage_percentage?: number
  current_period_end?: string
}

export default function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchSubscription()
  }, [])

  async function fetchSubscription() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/subscription-status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch subscription')

      const data = await response.json()
      setSubscription(data)
    } catch (err) {
      console.error('Subscription fetch error:', err)
      setError('Failed to load subscription status')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You\'ll retain access until the end of your current billing period.')) {
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/billing/cancel-subscription`,
        { method: 'POST' },
        session.access_token
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to cancel subscription')
      }

      // Refresh subscription data
      await fetchSubscription()
      alert('Subscription canceled successfully. You\'ll retain access until the end of your billing period.')
    } catch (err) {
      console.error('Cancel error:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReactivateSubscription() {
    setActionLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/billing/reactivate-subscription`,
        { method: 'POST' },
        session.access_token
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to reactivate subscription')
      }

      // Refresh subscription data
      await fetchSubscription()
      alert('Subscription reactivated successfully!')
    } catch (err) {
      console.error('Reactivate error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="subscription-card">
        <div className="subscription-loading">
          <div className="loading-spinner-large" />
          <p>Loading subscription...</p>
        </div>
      </div>
    )
  }

  if (!subscription?.has_subscription) {
    return (
      <div className="subscription-card subscription-card-warning">
        <div className="subscription-header">
          <h3>No Stripe subscription</h3>
        </div>
        <p className="subscription-message">
          This org has no Stripe subscription. Its plan tier and quotas are set by the operator.
        </p>
        <a href="/pricing" className="subscription-cta">
          View plan limits
        </a>
      </div>
    )
  }

  const planTier = subscription.plan_tier?.toUpperCase() || 'UNKNOWN'
  const requestsUsed = subscription.requests_used || 0
  const requestsLimit = subscription.requests_limit
  const usagePercentage = subscription.usage_percentage || 0
  const periodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'Unknown'

  // Determine usage status color
  let usageStatusClass = 'usage-bar-normal'
  if (usagePercentage >= 90) {
    usageStatusClass = 'usage-bar-critical'
  } else if (usagePercentage >= 75) {
    usageStatusClass = 'usage-bar-warning'
  }

  return (
    <div className="subscription-card">
      {error && (
        <div className="subscription-error" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      <div className="subscription-header">
        <div>
          <h3 className="subscription-plan-title">
            {planTier} PLAN
          </h3>
          <span className={`subscription-status-badge ${subscription.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
            {subscription.status?.toUpperCase()}
          </span>
        </div>
        <div className="subscription-actions">
          <a 
            href="/pricing" 
            className="action-link"
            aria-label="View plan limits"
          >
            Plan limits
          </a>
          {subscription.status === 'active' && (
            <button
              onClick={handleCancelSubscription}
              className="action-link action-link-danger"
              disabled={actionLoading}
              aria-label="Cancel subscription"
            >
              {actionLoading ? 'Processing...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Usage Meter */}
      <div className="usage-section">
        <div className="usage-header">
          <span className="usage-label">API Requests</span>
          <span className="usage-numbers">
            {requestsUsed.toLocaleString()} / {requestsLimit ? requestsLimit.toLocaleString() : '∞'}
          </span>
        </div>
        
        <div className="usage-bar-container">
          <div 
            className={`usage-bar ${usageStatusClass}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            role="progressbar"
            aria-valuenow={usagePercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`API usage: ${usagePercentage}%`}
          />
        </div>

        {usagePercentage >= 75 && (
          <div className={`usage-warning ${usagePercentage >= 90 ? 'usage-warning-critical' : ''}`}>
            {usagePercentage >= 90 ? '⚠️ Critical: ' : '⚡ Warning: '}
            You've used {usagePercentage.toFixed(1)}% of your monthly limit.
            {usagePercentage >= 90 && ' Consider upgrading your plan.'}
          </div>
        )}
      </div>

      {/* Billing Period */}
      <div className="billing-period">
        <div className="billing-item">
          <span className="billing-label">Current Period Ends</span>
          <span className="billing-value">{periodEnd}</span>
        </div>
        {subscription.status === 'active' && (
          <p className="billing-note">
            Your plan will automatically renew on this date.
          </p>
        )}
      </div>

      {/* Plan Features Quick View */}
      <div className="plan-features-summary">
        <h4>Your Plan Includes:</h4>
        <ul>
          {planTier === 'STARTER' && (
            <>
              <li>✓ 100,000 requests/month</li>
              <li>✓ 1 project</li>
              <li>✓ 3 team members</li>
              <li>✓ Email support</li>
            </>
          )}
          {planTier === 'PROFESSIONAL' && (
            <>
              <li>✓ 1,000,000 requests/month</li>
              <li>✓ 10 projects</li>
              <li>✓ 15 team members</li>
              <li>✓ Priority support (24h)</li>
              <li>✓ Advanced observability</li>
            </>
          )}
          {planTier === 'ENTERPRISE' && (
            <>
              <li>✓ Unlimited requests</li>
              <li>✓ Unlimited projects</li>
              <li>✓ Unlimited team members</li>
              <li>✓ Dedicated support (1h SLA)</li>
              <li>✓ SSO & audit logs</li>
            </>
          )}
        </ul>
      </div>

      {/* Reactivation Notice */}
      {subscription.status !== 'active' && (
        <div className="reactivation-notice">
          <p>Your subscription is scheduled for cancellation.</p>
          <button
            onClick={handleReactivateSubscription}
            className="subscription-cta"
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : 'Reactivate Subscription'}
          </button>
        </div>
      )}
    </div>
  )
}

