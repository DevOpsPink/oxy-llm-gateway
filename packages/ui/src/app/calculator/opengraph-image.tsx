/**
 * CALCULATOR OPEN GRAPH IMAGE
 * ============================
 * 
 * Preview image shown when /calculator is shared.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Oxy Token Cost Calculator - Compare LLM token costs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(0,102,255,0.15) 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, rgba(255,107,53,0.1) 0%, transparent 50%)`,
          }}
        />

        {/* FREE Badge */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              background: '#10B981',
              padding: '8px 20px',
              borderRadius: '6px',
              fontSize: 18,
              color: 'white',
              fontWeight: '700',
              letterSpacing: '0.5px',
            }}
          >
            OPEN SOURCE
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: 16,
              color: '#94A3B8',
              fontWeight: '500',
            }}
          >
            No signup required
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: 28,
              fontWeight: '600',
              color: '#FF6B35',
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            Compare LLM token costs
          </div>

          {/* Main Headline */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 24,
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            AI Cost Calculator
          </div>

          {/* Value Proposition */}
          <div
            style={{
              fontSize: 28,
              color: '#94A3B8',
              marginBottom: 40,
              maxWidth: 700,
            }}
          >
            Estimate spend per request and per month across providers
          </div>

          {/* Provider Comparison */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: 18,
                color: 'white',
                fontWeight: '500',
              }}
            >
              GPT-4o
            </div>
            <div style={{ fontSize: 24, color: '#475569' }}>vs</div>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: 18,
                color: 'white',
                fontWeight: '500',
              }}
            >
              Claude 3.5
            </div>
            <div style={{ fontSize: 24, color: '#475569' }}>vs</div>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: 18,
                color: 'white',
                fontWeight: '500',
              }}
            >
              Gemini 1.5
            </div>
          </div>
        </div>

        {/* Footer Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 48,
              height: 48,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #0066FF 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              ⚡
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            Oxy Engine
          </div>
          <div style={{ fontSize: 24, color: '#475569' }}>•</div>
          <div
            style={{
              fontSize: 24,
              color: '#0066FF',
              fontWeight: '500',
            }}
          >
            Oxy token calculator
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

