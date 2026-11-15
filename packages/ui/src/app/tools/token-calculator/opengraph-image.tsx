/**
 * OXY ENGINE - TOKEN CALCULATOR OPEN GRAPH IMAGE
 * ===============================================
 * 
 * Preview image shown when /tools/token-calculator is shared.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Universal AI Token Calculator - Compare OpenAI, Claude & Gemini Pricing'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'white',
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
        {/* Subtle Background Accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(0,102,255,0.03) 0%, rgba(255,107,53,0.03) 100%)',
          }}
        />

        {/* Top Badge */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
            background: '#0066FF',
            padding: '8px 20px',
            borderRadius: '6px',
            fontSize: 18,
            color: 'white',
            fontWeight: '600',
          }}
        >
          OPEN SOURCE
        </div>

        {/* Main Headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            color: '#0F172A',
            marginBottom: 32,
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          Universal AI Token Calculator
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: 32,
            color: '#64748B',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          Compare costs across OpenAI, Claude & Gemini instantly
        </div>

        {/* Calculator Icon (Center) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '40px',
            marginBottom: 48,
          }}
        >
          {/* Provider Pills */}
          <div
            style={{
              background: '#F1F5F9',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: 24,
              color: '#0F172A',
              fontWeight: '600',
              border: '2px solid #E2E8F0',
            }}
          >
            OpenAI GPT-4o
          </div>
          <div
            style={{
              fontSize: 48,
              color: '#CBD5E1',
            }}
          >
            •
          </div>
          <div
            style={{
              background: '#F1F5F9',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: 24,
              color: '#0F172A',
              fontWeight: '600',
              border: '2px solid #E2E8F0',
            }}
          >
            Claude 3.5
          </div>
          <div
            style={{
              fontSize: 48,
              color: '#CBD5E1',
            }}
          >
            •
          </div>
          <div
            style={{
              background: '#F1F5F9',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: 24,
              color: '#0F172A',
              fontWeight: '600',
              border: '2px solid #E2E8F0',
            }}
          >
            Gemini 1.5 Pro
          </div>
        </div>

        {/* Value Prop */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 32px',
            background: '#F0F9FF',
            borderRadius: '8px',
            border: '1px solid #BAE6FD',
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: '#0066FF',
            }}
          >
            💡
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#0369A1',
              fontWeight: '500',
            }}
          >
            Switch between providers with 1 line of code using Oxy Engine
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: '#94A3B8',
              fontWeight: '500',
            }}
          >
            Powered by
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#0066FF',
              fontWeight: 'bold',
            }}
          >
            Oxy Engine
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#CBD5E1',
            }}
          >
            •
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#94A3B8',
            }}
          >
            Self-hosted LLM gateway
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
