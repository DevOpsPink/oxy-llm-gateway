'use client'

/**
 * COOKIE BANNER CONTEXT
 * =====================
 * Global state to track cookie banner visibility.
 * 
 * Used by:
 * - CookieBanner component (sets visibility)
 * - Scroll-to-top button (adjusts position when banner visible)
 * 
 * Prevents UI collision between banner and floating buttons.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface CookieBannerContextType {
  isVisible: boolean
  setIsVisible: (visible: boolean) => void
  acknowledge: () => void
}

const CookieBannerContext = createContext<CookieBannerContextType | undefined>(undefined)

export function CookieBannerProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already acknowledged
    const acknowledged = localStorage.getItem('cookie_consent_acknowledged')
    if (!acknowledged) {
      // Show banner after 1 second delay (better UX than immediate)
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const acknowledge = () => {
    localStorage.setItem('cookie_consent_acknowledged', 'true')
    localStorage.setItem('cookie_consent_timestamp', new Date().toISOString())
    setIsVisible(false)
  }

  return (
    <CookieBannerContext.Provider value={{ isVisible, setIsVisible, acknowledge }}>
      {children}
    </CookieBannerContext.Provider>
  )
}

export function useCookieBanner() {
  const context = useContext(CookieBannerContext)
  if (context === undefined) {
    // Return safe defaults if used outside provider (graceful degradation)
    return {
      isVisible: false,
      setIsVisible: () => {},
      acknowledge: () => {}
    }
  }
  return context
}

