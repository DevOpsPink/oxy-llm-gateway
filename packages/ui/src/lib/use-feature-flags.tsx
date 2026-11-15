/**
 * FEATURE FLAGS SYSTEM
 * =====================
 * Gradual rollouts for risky features using PostHog
 * 
 * Usage:
 * const { isEnabled } = useFeatureFlag('new-pricing-page')
 * if (isEnabled) {
 *   return <NewPricingPage />
 * } else {
 *   return <OldPricingPage />
 * }
 */

'use client'

import { useEffect, useState } from 'react'
import { isFeatureEnabled } from '@/lib/posthog'

// Feature flag definitions
export const FEATURE_FLAGS = {
  NEW_PRICING_PAGE: 'new-pricing-page',
  AI_COST_PREDICTOR: 'ai-cost-predictor',
  TEAM_COLLABORATION_V2: 'team-collaboration-v2',
  ADVANCED_ANALYTICS: 'advanced-analytics',
  DARK_MODE: 'dark-mode',
  KEYBOARD_SHORTCUTS: 'keyboard-shortcuts',
  BUDGET_RECOMMENDATIONS: 'budget-recommendations',
} as const

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

/**
 * Hook to check if a feature flag is enabled
 */
export function useFeatureFlag(flagName: FeatureFlagKey) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if feature is enabled
    const enabled = isFeatureEnabled(flagName)
    setIsEnabled(enabled)
    setIsLoading(false)
  }, [flagName])

  return { isEnabled, isLoading }
}

/**
 * Component wrapper for feature flags
 * 
 * Usage:
 * <FeatureFlag name="new-pricing-page">
 *   <NewPricingPage />
 * </FeatureFlag>
 */
export function FeatureFlag({
  name,
  children,
  fallback,
}: {
  name: FeatureFlagKey
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { isEnabled, isLoading } = useFeatureFlag(name)

  if (isLoading) {
    return null
  }

  if (!isEnabled && fallback) {
    return <>{fallback}</>
  }

  return isEnabled ? <>{children}</> : null
}

/**
 * Higher-order component for feature flags
 * 
 * Usage:
 * const NewPricingPage = withFeatureFlag('new-pricing-page', PricingPageComponent)
 */
export function withFeatureFlag<P extends object>(
  flagName: FeatureFlagKey,
  Component: React.ComponentType<P>,
  Fallback?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const { isEnabled, isLoading } = useFeatureFlag(flagName)

    if (isLoading) {
      return null
    }

    if (!isEnabled && Fallback) {
      return <Fallback {...props} />
    }

    return isEnabled ? <Component {...props} /> : null
  }
}

/**
 * Multi-variant feature flags (A/B/C testing)
 * 
 * Usage:
 * const variant = useFeatureVariant('pricing-test', ['control', 'variant-a', 'variant-b'])
 */
export function useFeatureVariant(
  flagName: string,
  variants: string[]
): { variant: string; isLoading: boolean } {
  const [variant, setVariant] = useState(variants[0]) // Default to first variant
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Use PostHog multivariate flags
    // For now, simple hash-based variant assignment
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
    
    if (userId) {
      const hash = hashString(userId + flagName)
      const variantIndex = hash % variants.length
      setVariant(variants[variantIndex])
    }
    
    setIsLoading(false)
  }, [flagName, variants])

  return { variant, isLoading }
}

// Simple hash function for variant assignment
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

