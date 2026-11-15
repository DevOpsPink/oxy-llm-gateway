/**
 * OXY ENGINE - DYNAMIC OPEN GRAPH IMAGE (LANDING PAGE)
 * ======================================================
 * 
 * Generates the link-preview image for the landing page.
 * 
 * Next.js convention:
 * - File location: app/opengraph-image.tsx
 * - Auto-generates /opengraph-image route
 * - Dynamic rendering with next/og
 */

import { ImageResponse } from 'next/og'

// Runtime Configuration
export const runtime = 'edge'
export const alt = 'Oxy Engine - Kill Switch for Rogue AI Agents | AI Control Plane'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Background Grid Pattern (Trust Signal) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.3,
          }}
        />

        {/* Logo/Wordmark (Top-Left) */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            fontSize: 36,
            fontWeight: 'bold',
            color: 'white',
            letterSpacing: '-0.02em',
          }}
        >
          Oxy Engine
        </div>

        {/* Main Headline (Center) */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 32,
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: 900,
            textShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          Kill Switch for Rogue Agents
        </div>

        {/* Subheadline (Below Headline) */}
        <div
          style={{
            fontSize: 36,
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          AI Control Plane • Project Budgets • Cloud + Local Models
        </div>

        {/* Feature Badges (Below Subheadline) */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: 48,
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: 20,
              color: 'white',
              fontWeight: '600',
            }}
          >
            ⚡ Kill Switch &lt;5ms
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: 20,
              color: 'white',
              fontWeight: '600',
            }}
          >
            💰 Project Budgets
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: 20,
              color: 'white',
              fontWeight: '600',
            }}
          >
            🔒 Self-hosted
          </div>
        </div>

        {/* Footer (Bottom-Right) */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 60,
            fontSize: 28,
            color: 'rgba(255,255,255,0.6)',
            fontWeight: '500',
          }}
        >
          Self-hosted LLM gateway
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

/**
 * HOW IT WORKS:
 * 
 * 1. Next.js automatically generates /opengraph-image at build time
 * 2. Social media platforms fetch this image when link is shared
 * 3. Edge runtime ensures <100ms generation time
 * 
 * TESTING:
 * 
 * 1. Local preview: http://localhost:3000/opengraph-image
 * 2. Facebook Debugger: https://developers.facebook.com/tools/debug/
 * 3. Twitter Card Validator: https://cards-dev.twitter.com/validator
 * 4. iMessage: Send link to yourself on iPhone
 * 
 * TROUBLESHOOTING:
 * 
 * - If image doesn't update on social media, clear cache in debugger tools
 * - Vercel auto-deploys this as serverless function (no manual upload needed)
 * - Image is cached for 7 days (revalidate with ?v=2 query param)
 */

