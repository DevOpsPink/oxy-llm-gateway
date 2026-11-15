/**
 * PostHog Analytics Integration (optional)
 * ========================================
 * Product analytics, active only when NEXT_PUBLIC_POSTHOG_KEY is set.
 * 
 * Features:
 * - Pageview tracking
 * - Event tracking
 * - User identification
 * - Feature flags (A/B testing)
 */

import posthog from 'posthog-js'

// Initialize PostHog only on client-side
export const initPostHog = () => {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      // Automatic tracking
      capture_pageview: true,
      capture_pageleave: true,
      // Disable autocapture (we track explicitly for better control)
      autocapture: false,
      // Privacy settings
      disable_session_recording: false, // Enable session replay for debugging
      mask_all_text: false,
      mask_all_element_attributes: false,
      // Performance
      loaded: (posthog) => {
        // PostHog Analytics initialized
      }
    })
  }
}

// Identify user (call after login)
export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.identify(userId, traits)
  }
}

// Reset identity (call after logout)
export const resetUser = () => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.reset()
  }
}

// Track custom event
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture(eventName, properties)
  }
}

// Feature flags
export const isFeatureEnabled = (flagName: string): boolean => {
  if (typeof window !== 'undefined' && posthog) {
    return posthog.isFeatureEnabled(flagName) || false
  }
  return false
}

// ============================================================================
// PRE-DEFINED ANALYTICS EVENTS
// ============================================================================

/**
 * Onboarding Events
 */
export const analytics = {
  // Onboarding
  onboardingStarted: (source: string) => {
    trackEvent('onboarding_started', { source })
  },
  
  onboardingCompleted: (data: {
    provider: 'openai' | 'anthropic' | 'google'
    timeToOnboardSeconds: number
  }) => {
    trackEvent('onboarding_completed', data)
  },
  
  // API Usage
  firstApiCall: (data: {
    model: string
    timeSinceOnboardingMinutes: number
  }) => {
    trackEvent('first_api_call', data)
  },
  
  apiKeyCreated: (data: {
    projectId: string
    keyName: string
  }) => {
    trackEvent('api_key_created', data)
  },
  
  // Budget Events
  budgetSet: (data: {
    projectId: string
    budgetLimit: number
    previousLimit?: number
  }) => {
    trackEvent('budget_set', data)
  },
  
  budgetExceeded: (data: {
    projectId: string
    budgetLimit: number
    currentSpend: number
    timeToExceedHours: number
  }) => {
    trackEvent('budget_exceeded', data)
  },
  
  budgetAlertThreshold: (data: {
    projectId: string
    threshold: number // 50%, 80%, 90%
    currentSpend: number
    budgetLimit: number
  }) => {
    trackEvent('budget_alert_threshold', data)
  },
  
  // Team Collaboration
  teamInviteSent: (data: {
    organizationId: string
    role: 'developer' | 'viewer'
  }) => {
    trackEvent('team_invite_sent', data)
  },
  
  teamInviteAccepted: (data: {
    organizationId: string
    role: 'developer' | 'viewer'
  }) => {
    trackEvent('team_invite_accepted', data)
  },
  
  // Project Management
  projectCreated: (data: {
    projectId: string
    projectName: string
    initialBudget: number
  }) => {
    trackEvent('project_created', data)
  },
  
  projectDeleted: (data: {
    projectId: string
  }) => {
    trackEvent('project_deleted', data)
  },
  
  // Provider Management
  providerConnected: (data: {
    provider: 'openai' | 'anthropic' | 'google'
  }) => {
    trackEvent('provider_connected', data)
  },
  
  providerDisconnected: (data: {
    provider: 'openai' | 'anthropic' | 'google'
  }) => {
    trackEvent('provider_disconnected', data)
  },
  
  // Error Tracking
  errorOccurred: (data: {
    errorType: string
    errorMessage: string
    page: string
  }) => {
    trackEvent('error_occurred', data)
  },
  
  // Subscription events (optional Stripe module)
  trialStarted: () => {
    trackEvent('trial_started', {})
  },
  
  subscriptionCreated: (data: {
    plan: 'starter' | 'growth' | 'business' | 'enterprise'
    billingInterval: 'month' | 'year'
  }) => {
    trackEvent('subscription_created', data)
  },
  
  subscriptionCancelled: (data: {
    plan: string
    reason?: string
  }) => {
    trackEvent('subscription_cancelled', data)
  },
  
  // Engagement
  dashboardViewed: () => {
    trackEvent('dashboard_viewed', {})
  },
  
  settingsViewed: () => {
    trackEvent('settings_viewed', {})
  },
  
  docsViewed: (page: string) => {
    trackEvent('docs_viewed', { page })
  }
}

export { posthog }
export default analytics

