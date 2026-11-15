'use client'

/**
 * GLOBAL ERROR BOUNDARY - Root Level
 * ====================================
 * 
 * Catches errors at the root layout level.
 * Last line of defense before complete app crash.
 * 
 * Note: Uses inline styles because CSS may not be loaded.
 * Styled to match Oxy brand colors.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('CRITICAL: Root-level error:', error)
    }
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Aurora blobs */}
          <div style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '50vw',
            height: '50vw',
            background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
            borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute',
            top: '10%',
            right: '-10%',
            width: '45vw',
            height: '45vw',
            background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)',
            filter: 'blur(60px)',
            borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-10%',
            left: '20%',
            width: '40vw',
            height: '40vw',
            background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)',
            filter: 'blur(60px)',
            borderRadius: '50%',
          }} />

          {/* Logo */}
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F472B6 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 20px 40px rgba(139,92,246,0.3)',
            position: 'relative',
            zIndex: 10,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
              <path d="M12 2V4M12 20V22M2 12H4M20 12H22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0f172a',
            marginBottom: '8px',
            position: 'relative',
            zIndex: 10,
          }}>
            Oxy Control Plane
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '32px',
            position: 'relative',
            zIndex: 10,
          }}>
            AI Control Plane • Kill Switch for Agents
          </p>

          {/* Error Card */}
          <div style={{
            maxWidth: '450px',
            width: '100%',
            padding: '32px',
            background: 'rgba(255,255,255,0.85)',
            borderRadius: '16px',
            border: '1px solid rgba(148,163,184,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            textAlign: 'center',
            position: 'relative',
            zIndex: 10,
          }}>
            {/* Error Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 12px 24px rgba(245,158,11,0.3)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.55 19C1.55 19.36 1.64 19.7 1.82 20C2 20.3 2.26 20.56 2.56 20.74C2.86 20.92 3.21 21.01 3.56 21H20.44C20.79 21.01 21.14 20.92 21.44 20.74C21.74 20.56 22 20.3 22.18 20C22.36 19.7 22.45 19.36 22.45 19C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.32 12.97 3.15C12.67 2.98 12.33 2.89 11.99 2.89C11.65 2.89 11.31 2.98 11.01 3.15C10.71 3.32 10.47 3.56 10.29 3.86Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#0f172a',
            }}>
              Critical Error
            </h1>
            
            <p style={{
              color: '#64748b',
              marginBottom: '24px',
              fontSize: '15px',
              lineHeight: '1.6',
            }}>
              A critical error occurred.<br />The error has been logged.
            </p>
            
            {error.digest && (
              <p style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginBottom: '24px',
                fontFamily: 'monospace',
                padding: '8px 12px',
                background: 'rgba(148,163,184,0.1)',
                borderRadius: '8px',
              }}>
                Error ID: {error.digest}
              </p>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 8px 16px rgba(139,92,246,0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(139,92,246,0.4)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(139,92,246,0.3)'
                }}
              >
                Try Again
              </button>
              
              <button
                onClick={() => router.push('/')}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#475569',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseOut={(e) => e.currentTarget.style.background = 'white'}
              >
                Go Home
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '32px',
            position: 'relative',
            zIndex: 10,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: '20px',
              border: '1px solid rgba(148,163,184,0.35)',
              fontSize: '13px',
              color: '#64748b',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 12L11 14L15 10" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Your data is safe
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: '20px',
              border: '1px solid rgba(148,163,184,0.35)',
              fontSize: '13px',
              color: '#64748b',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 12L11 14L15 10" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Auto-recovery enabled
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
