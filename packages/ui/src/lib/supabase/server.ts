import { createServerClient } from '@supabase/ssr'
import { authCookieOptions } from './cookie-options'
import { cookies } from 'next/headers'

/**
 * Create Supabase client for server-side operations (Next.js 15/16).
 * 
 * CRITICAL: Use this in Server Components, Server Actions, and API Routes.
 * 
 * Features:
 * - SSR-safe cookie handling via Next.js cookies()
 * - Automatic session refresh
 * - Type-safe with @supabase/ssr
 * 
 * Usage:
 * ```ts
 * import { createClient } from '@/lib/supabase/server'
 * 
 * export async function GET() {
 *   const supabase = await createClient()
 *   const { data: { session } } = await supabase.auth.getSession()
 *   // ...
 * }
 * ```
 */
export async function createClient() {
  // Prefer INTERNAL_SUPABASE_URL on the server (docker-network DNS like
  // http://nginx-postgrest:8080) and fall back to NEXT_PUBLIC_SUPABASE_URL
  // (e.g. http://localhost:8080) when no internal URL is configured. The
  // browser always uses NEXT_PUBLIC_SUPABASE_URL; the two only diverge in
  // Docker, where the SSR runtime can't reach the host port via localhost.
  const supabaseUrl =
    process.env.INTERNAL_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

