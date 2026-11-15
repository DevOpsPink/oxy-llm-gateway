'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initPostHog } from '@/lib/posthog'

/**
 * Client-side providers wrapper
 * Initializes analytics and other client-side services
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  useEffect(() => {
    // Initialize PostHog on mount
    initPostHog()
  }, [])
  
  // Track page views on route change
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname) {
      // PostHog automatically tracks pageviews, but we can add custom logic here
      if (process.env.NODE_ENV === 'development') {
      // Track page view
    }
    }
  }, [pathname])
  
  return <>{children}</>
}

