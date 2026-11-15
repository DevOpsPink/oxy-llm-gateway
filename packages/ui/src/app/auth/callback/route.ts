import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { authCookieOptions, publicSiteUrl } from '@/lib/supabase/cookie-options'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Security: Validate environment variables.
  // Server-side route: prefer INTERNAL_SUPABASE_URL (docker-network DNS,
  // e.g. http://nginx-postgrest:8080) and fall back to the NEXT_PUBLIC_
  // URL the browser uses. INTERNAL_API_URL is the docker-network address
  // for the gateway.
  const supabaseUrl =
    process.env.INTERNAL_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const internalApiUrl = process.env.INTERNAL_API_URL

  if (!supabaseUrl || !supabaseAnonKey) {
    // Log error but don't expose details to client
    console.error("Auth callback: Missing Supabase environment variables")
    return NextResponse.redirect(`${publicSiteUrl(origin)}/auth/auth-code-error`)
  }

  // Security: Validate origin to prevent open redirects
  // CRITICAL: Define safeOrigin before use to prevent undefined errors
  // Behind Docker port mapping or a reverse proxy, request.url carries the
  // container's own origin, so prefer the configured public site URL.
  const siteUrl = publicSiteUrl(origin)
  const safeOrigin = siteUrl.startsWith('http://localhost') || siteUrl.startsWith('https://')
    ? siteUrl
    : 'http://localhost:3000'

  if (code) {
    
    const response = NextResponse.redirect(`${safeOrigin}/onboarding`)

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookieOptions: authCookieOptions(),
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options, maxAge: 0 })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      try {
        // Only check status if INTERNAL_API_URL is configured
        if (internalApiUrl) {
          const res = await fetch(`${internalApiUrl}/management/status`, {
            headers: { 
              'Authorization': `Bearer ${data.session.access_token}` 
            },
            // Security: Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(5000)
          })

          if (res.ok) {
            const statusData = await res.json()

            if (statusData.onboarded === true) {
              response.headers.set('Location', `${safeOrigin}/dashboard`)
            } 
          }
        }
        return response

      } catch (e) {
        // Log error but don't expose details
        console.error("Auth callback: Error checking onboarding status")
        // Still redirect to onboarding - let the proxy handle routing
        return response
      }
    }
  }

  return NextResponse.redirect(`${safeOrigin}/auth/auth-code-error`)
}