import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { authCookieOptions } from '@/lib/supabase/cookie-options'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname, search, hash, origin } = request.nextUrl
  const requestHost = request.headers.get('host')

  // Security: Prevent open redirects - only allow localhost redirects in development
  if (process.env.NODE_ENV === 'development' && (requestHost === '127.0.0.1:3000' || requestHost === '0.0.0.0:3000')) {
    const newUrl = new URL(`http://localhost:3000${pathname}${search}${hash}`)
    // Validate that the redirect stays on localhost
    if (newUrl.hostname === 'localhost' || newUrl.hostname === '127.0.0.1') {
      return NextResponse.redirect(newUrl, 301)
    }
  }

  let response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  })

  // Middleware runs server-side in Next.js. Prefer INTERNAL_SUPABASE_URL
  // (docker-network DNS like http://nginx-postgrest:8080) when set, and
  // fall back to the NEXT_PUBLIC_ url used by the browser otherwise. The
  // two only diverge in Docker; in hosted deployments they're the same.
  const supabaseUrl =
    process.env.INTERNAL_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Proxy: Missing Supabase environment variables")
    return response
  }
  
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
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: new Headers(request.headers),
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.delete(name)
          response = NextResponse.next({
            request: {
              headers: new Headers(request.headers),
            },
          })
          response.cookies.delete(name)
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const protectedRoutes = ['/dashboard', '/settings']
  const onboardingRoute = '/onboarding'
  const authRoutes = ['/login', '/auth/auth-code-error']

  if (!session) {
    if (protectedRoutes.includes(pathname) || pathname === onboardingRoute) {
      // Security: Always use relative redirects to prevent open redirects
      const loginUrl = new URL('/login', request.url)
      // Ensure we're redirecting to the same origin
      if (loginUrl.origin === new URL(request.url).origin) {
        return NextResponse.redirect(loginUrl)
      }
    }
    return response
  }

  // Tri-state onboarding status
  // null = unknown (status check failed) → allow navigation (fail open)
  // true = confirmed onboarded → redirect to dashboard if on auth pages
  // false = confirmed NOT onboarded → redirect to onboarding
  let isOnboarded: boolean | null = null
  
  // Security: Validate INTERNAL_API_URL exists (server-only variable for Docker networking)
  const internalApiUrl = process.env.INTERNAL_API_URL
  if (!internalApiUrl) {
    console.error("Proxy: INTERNAL_API_URL not configured")
    // Continue without status check - let routes handle auth
    return response
  }
  
  try {
    const statusRes = await fetch(`${internalApiUrl}/management/status`, {
      headers: { 
        'Authorization': `Bearer ${session.access_token}` 
      },
      cache: 'no-store',
      // Security: Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    })
    
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      // 🔧 CRITICAL: Set to explicit true/false based on API response
      isOnboarded = statusData.onboarded === true
    } else {
      console.error("Proxy: Failed to fetch management status", statusRes.status)
      // 🔧 CRITICAL: Leave as null (unknown) - don't assume false!
      // This prevents redirect loops when status endpoint has issues
    }
  } catch (e) {
    // Log error but don't expose details
    if (process.env.NODE_ENV === 'development') {
      console.error("Proxy: Error checking onboarding status", e)
    }
    // 🔧 CRITICAL: Leave as null (unknown) - fail open for availability
    // Users can access routes; client-side guards will handle edge cases
  }

  // Security: Validate redirect URLs are same-origin
  const currentOrigin = new URL(request.url).origin
  
  // Only redirect if we have CONFIRMED onboarding status
  if (isOnboarded === true) {
    // User is CONFIRMED onboarded → redirect away from auth/onboarding pages
    if (authRoutes.includes(pathname) || pathname === onboardingRoute) {
      const dashboardUrl = new URL('/dashboard', request.url)
      if (dashboardUrl.origin === currentOrigin) {
        return NextResponse.redirect(dashboardUrl)
      }
    }
  } else if (isOnboarded === false) {
    // User is CONFIRMED not onboarded → redirect to onboarding
    // CRITICAL: Only redirect for protected routes, not public pages
    if (protectedRoutes.includes(pathname)) {
      const onboardingUrl = new URL('/onboarding', request.url)
      if (onboardingUrl.origin === currentOrigin) {
        return NextResponse.redirect(onboardingUrl)
      }
    }
  }
  // 🔧 If isOnboarded === null (unknown), allow navigation
  // Client-side guards will handle edge cases

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|/auth/callback).*)',
  ],
}