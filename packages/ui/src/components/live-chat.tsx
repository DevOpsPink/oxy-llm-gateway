'use client'

/**
 * LIVE CHAT INTEGRATION
 * ======================
 * Optional Intercom or Crisp widget, loaded only when the operator sets
 * NEXT_PUBLIC_INTERCOM_APP_ID (or the Crisp equivalent).
 */

import { useEffect } from 'react'

interface LiveChatProps {
  user?: {
    id: string
    email: string
    full_name?: string
  } | null
}

export function LiveChat({ user }: LiveChatProps) {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    // Check if Intercom is configured
    const appId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID
    
    if (!appId) {
      console.warn('Intercom not configured. Set NEXT_PUBLIC_INTERCOM_APP_ID in .env')
      return
    }

    // Load Intercom script
    (function(){
      const w = window as any
      const ic = w.Intercom
      
      if (typeof ic === "function") {
        ic('reattach_activator')
        ic('update', w.intercomSettings)
      } else {
        const d = document
        const i:any = function(){
          i.c(arguments)
        }
        i.q = []
        i.c = function(args:any){
          i.q.push(args)
        }
        w.Intercom = i
        
        const l = function(){
          const s = d.createElement('script')
          s.type = 'text/javascript'
          s.async = true
          s.src = `https://widget.intercom.io/widget/${appId}`
          const x = d.getElementsByTagName('script')[0]
          x.parentNode!.insertBefore(s, x)
        }
        
        if (document.readyState === 'complete') {
          l()
        } else if (w.attachEvent) {
          w.attachEvent('onload', l)
        } else {
          w.addEventListener('load', l, false)
        }
      }
    })()

    // Initialize Intercom with user data
    const intercomSettings = {
      app_id: appId,
      ...(user && {
        user_id: user.id,
        email: user.email,
        name: user.full_name || user.email,
        created_at: Math.floor(Date.now() / 1000) // Unix timestamp
      })
    }

    ;(window as any).intercomSettings = intercomSettings
    ;(window as any).Intercom?.('boot', intercomSettings)

    // Cleanup
    return () => {
      ;(window as any).Intercom?.('shutdown')
    }
  }, [user])

  return null // No visual component, just script loader
}

/**
 * ALTERNATIVE: CRISP CHAT
 * ========================
 * Lighter alternative to Intercom (free for small teams)
 */

export function CrispChat({ user }: LiveChatProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID
    
    if (!websiteId) {
      console.warn('Crisp not configured. Set NEXT_PUBLIC_CRISP_WEBSITE_ID in .env')
      return
    }

    // Load Crisp
    ;(window as any).$crisp = []
    ;(window as any).CRISP_WEBSITE_ID = websiteId
    
    const s = document.createElement('script')
    s.src = 'https://client.crisp.chat/l.js'
    s.async = true
    document.getElementsByTagName('head')[0].appendChild(s)

    // Set user data if available
    if (user) {
      ;(window as any).$crisp.push(['set', 'user:email', user.email])
      ;(window as any).$crisp.push(['set', 'user:nickname', user.full_name || user.email])
    }

    return () => {
      // Cleanup
      ;(window as any).$crisp = undefined
    }
  }, [user])

  return null
}

/**
 * USAGE EXAMPLE
 * =============
 * Add to root layout.tsx:
 * 
 * import { LiveChat } from '@/components/live-chat'
 * 
 * export default function RootLayout({ children }) {
 *   const { user } = useAuth()
 *   
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <LiveChat user={user} />
 *       </body>
 *     </html>
 *   )
 * }
 * 
 * ENVIRONMENT VARIABLES
 * =====================
 * .env.local:
 * NEXT_PUBLIC_INTERCOM_APP_ID=your_app_id_here
 * or
 * NEXT_PUBLIC_CRISP_WEBSITE_ID=your_website_id_here
 */

