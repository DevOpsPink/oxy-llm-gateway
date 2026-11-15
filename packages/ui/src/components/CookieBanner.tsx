/**
 * COOKIE BANNER COMPONENT
 * =======================
 * GDPR-compliant cookie disclosure banner for essential cookies.
 * 
 * Legal Context:
 * - GDPR does NOT require consent for "strictly necessary" cookies (auth, security)
 * - We only need DISCLOSURE (transparency principle) — not blocking consent
 * - No backdrop/blur overlay — that's for tracking cookies requiring opt-in
 * 
 * UX rationale:
 * - Non-blocking banner = user can interact immediately
 * - Simple "Got it" acknowledgment (not consent — cookies are essential)
 * - Following industry standard (Stripe, Vercel, Linear approach)
 * 
 * Technical:
 * - Uses global CookieBannerContext for state (allows other components to react)
 * - No server-side tracking needed for essential cookies
 * - Dismissible with X button or "Got it" button
 * - z-index: 60 (higher than scroll-to-top button at 50)
 * 
 * Created: 2025-11-20
 * Updated: 2025-12-01 - Added context for global state, higher z-index
 */

'use client'

import { X, Cookie } from 'lucide-react'
import { Button } from './ui/button'
import Link from 'next/link'
import { useCookieBanner } from '@/contexts/cookie-banner-context'

export function CookieBanner() {
  const { isVisible, acknowledge } = useCookieBanner()

  if (!isVisible) return null

  return (
    <>
      {/* No blocking overlay - GDPR doesn't require consent for essential cookies */}
      
      {/* Banner - non-blocking, just informational */}
      {/* z-60 is higher than scroll-to-top (z-50) to ensure proper layering */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] animate-in slide-in-from-bottom duration-500">
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-t border-slate-700">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {/* Icon + Message - centered */}
              <div className="flex items-center gap-3">
                <Cookie className="h-5 w-5 text-violet-400 shrink-0" />
                <p className="text-sm sm:text-base leading-relaxed">
                  We use <strong className="font-semibold text-white">essential cookies</strong> for authentication and security. 
                  We don’t use third-party advertising or marketing trackers. Your data stays private.
                  {' '}
                  <Link 
                    href="/privacy" 
                    className="underline hover:text-violet-400 transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Learn more
                  </Link>
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  onClick={acknowledge}
                  size="sm"
                  className="bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium px-6 rounded-xl shadow-lg shadow-violet-500/25 transition-all"
                >
                  Got it
                </Button>
                <button
                  onClick={acknowledge}
                  className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/10"
                  aria-label="Close cookie banner"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
