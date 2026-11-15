import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Hosts the dev server answers besides localhost (the devcontainer's proxy
  // origin in Codespaces); comma-separated, from .devcontainer/start.sh.
  allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS || '').split(',').map((h) => h.trim()).filter(Boolean),
  
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()'
          },
          {
            key: 'Content-Security-Policy',
            value: (() => {
              const isDevelopment = process.env.NODE_ENV !== 'production'
              
              // Production CSP (stricter)
              const productionCSP = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval'", // Next.js requires unsafe-eval (can't be removed)
                "style-src 'self' 'unsafe-inline'", // Tailwind CSS requires unsafe-inline
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self' https://checkout.stripe.com", // Allow Stripe checkout
                "frame-src 'self' https://checkout.stripe.com https://js.stripe.com", // Stripe frames
                "object-src 'none'",
                "upgrade-insecure-requests"
              ]
              
              // Development CSP (more permissive for hot reload)
              const developmentCSP = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Dev mode needs unsafe-inline
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.supabase.co wss://*.supabase.co",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-src 'none'",
                "object-src 'none'"
              ]
              
              return (isDevelopment ? developmentCSP : productionCSP).join('; ')
            })()
          }
        ],
      },
    ]
  },
};

export default nextConfig;
