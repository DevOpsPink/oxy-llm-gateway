/**
 * One auth cookie name for browser and server.
 *
 * supabase-js names the session cookie after the Supabase URL's host
 * (`sb-<host>-auth-token`). The browser uses NEXT_PUBLIC_SUPABASE_URL
 * (http://localhost:8080 in the local stack), while server code may use
 * INTERNAL_SUPABASE_URL (http://nginx-postgrest:8080 inside Docker). Without a
 * pinned name the server looks for a different cookie, never sees the browser's
 * session or PKCE verifier, and the magic-link callback fails.
 */
export function authCookieOptions(): { name: string } | undefined {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!publicUrl) return undefined
  try {
    return { name: `sb-${new URL(publicUrl).hostname.split('.')[0]}-auth-token` }
  } catch {
    return undefined
  }
}

/** Where to send the browser after auth: the public site URL, not the container's own origin. */
export function publicSiteUrl(fallback: string): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || fallback).replace(/\/+$/, '')
}
