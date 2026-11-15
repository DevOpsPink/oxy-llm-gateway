'use client'

/**
 * PWA INSTALL PROMPT
 * ==================
 * Smart install prompt that appears after user engagement
 * 
 * Strategy:
 * - Show after 30 seconds of engagement (not immediately)
 * - Dismiss once per session (not annoying)
 * - Track install events for analytics
 * - Beautiful gradient card with clear value props
 * 
 * UX rationale: Progressive disclosure
 * - User already engaged with product
 * - Clear benefits (faster access, offline)
 * - Easy to dismiss (not forced)
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Download, X, Zap, Wifi, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    
    // Don't show if already dismissed in this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return
    
    // Don't show if permanently dismissed
    if (localStorage.getItem('pwa-install-permanently-dismissed')) return
    
    let hasShown = false
    
    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Show after 30 seconds of engagement
      setTimeout(() => {
        if (!hasShown) {
          hasShown = true
          setShowPrompt(true)
        }
      }, 30000) // 30 seconds
    }
    
    window.addEventListener('beforeinstallprompt', handler)
    
    // Listen for successful install
    const installHandler = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      
      // Track successful install
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'pwa_installed',
          timestamp: new Date().toISOString()
        })
      }).catch(console.error)
      
      // Show success message
      toast.success('App installed! You can now access Oxy Engine from your home screen.')
    }
    
    window.addEventListener('appinstalled', installHandler)
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installHandler)
    }
  }, [])
  
  const handleInstall = async () => {
    if (!deferredPrompt) return
    
    // Show native install prompt
    deferredPrompt.prompt()
    
    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice
    
    // Track analytics
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'pwa_install_prompt_result',
        outcome,
        timestamp: new Date().toISOString()
      })
    }).catch(console.error)
    
    if (outcome === 'accepted') {
      toast.success('Installing app...')
    }
    
    // Reset
    setDeferredPrompt(null)
    setShowPrompt(false)
    sessionStorage.setItem('pwa-install-dismissed', 'true')
  }
  
  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('pwa-install-dismissed', 'true')
    
    // Track dismissal
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'pwa_install_prompt_dismissed',
        timestamp: new Date().toISOString()
      })
    }).catch(console.error)
  }
  
  const handlePermanentDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-permanently-dismissed', 'true')
    
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'pwa_install_prompt_permanently_dismissed',
        timestamp: new Date().toISOString()
      })
    }).catch(console.error)
  }
  
  // Don't show if already installed or not ready
  if (isInstalled || !showPrompt || !deferredPrompt) return null
  
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] sm:left-auto sm:right-4 sm:w-96 animate-slideInFromBottom">
      <Card className="shadow-2xl border-2 border-purple-600 bg-white overflow-hidden">
        {/* Gradient Header */}
        <div className="bg-linear-to-r from-purple-600 to-blue-600 p-4 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent" />
          
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h3 className="font-bold text-lg">Install Oxy Engine</h3>
              <p className="text-sm text-purple-100">Get the full app experience</p>
            </div>
          </div>
        </div>
        
        <CardContent className="p-4">
          {/* Benefits */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Instant Access</p>
                <p className="text-xs text-slate-600">Launch from your home screen</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Offline Support</p>
                <p className="text-xs text-slate-600">Works without internet connection</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Native Performance</p>
                <p className="text-xs text-slate-600">Faster and more responsive</p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleInstall}
              className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </Button>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleDismiss}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                Not Now
              </Button>
              <Button 
                onClick={handlePermanentDismiss}
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-slate-500"
              >
                Don't Ask Again
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-center text-slate-500 mt-3">
            Free • No storage space required • Uninstall anytime
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * USAGE
 * =====
 * Add to root layout.tsx:
 * 
 * import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <PWAInstallPrompt />
 *       </body>
 *     </html>
 *   )
 * }
 */

