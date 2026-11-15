'use client'

/**
 * ERROR BOUNDARY - Application Level (Oxy Brand Edition)
 * =======================================================
 * 
 * Catches errors in any page and provides graceful degradation.
 * Styled to match Oxy landing page for consistency.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Cpu, Home, RefreshCcw, AlertTriangle, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

// 🪟 GLASS CARD — matches landing page style
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <div 
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(148,163,184,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.5)'
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      })
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Aurora Background — matches landing page */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-white to-slate-100/95" />
        
        <div
          className="absolute top-[5%] -left-[15%] w-[60vw] h-[60vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(139,92,246,0.2) 50%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        
        <div
          className="absolute top-[10%] -right-[10%] w-[55vw] h-[55vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236,72,153,0.45) 0%, rgba(244,114,182,0.15) 50%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        
        <div
          className="absolute bottom-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, rgba(34,211,238,0.1) 50%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>
      
      {/* Logo Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center relative z-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="mx-auto h-16 w-16 bg-linear-to-br from-violet-600 via-fuchsia-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-violet-500/30"
        >
          <Cpu className="h-8 w-8 text-white" />
        </motion.div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
          Oxy Control Plane
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          AI Control Plane • Kill Switch for Agents
        </p>
      </div>

      {/* Error Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.1 }}
        className="w-full max-w-md relative z-10"
      >
        <GlassCard>
          <div className="p-8">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-linear-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                  <AlertTriangle className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Something Went Wrong
              </h3>
              <p className="text-slate-500">
                We hit a snag. Let's get you back on track.
              </p>
            </div>

            {/* Helpful message */}
            <GlassCard className="mb-4">
              <div className="p-4">
                <p className="text-sm text-slate-600">
                  The error has been logged.<br />You can try refreshing or head back to the dashboard.
                </p>
              </div>
            </GlassCard>

            {/* Error ID if available */}
            {error.digest && (
              <GlassCard className="mb-4">
                <div className="p-3">
                  <p className="text-xs text-slate-500">
                    Error ID: <span className="font-mono font-medium text-slate-700">{error.digest}</span>
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Dev info - only in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="bg-red-50/80 p-3 rounded-xl border border-red-200/50 mb-6">
                <summary className="text-xs font-semibold text-red-600 cursor-pointer">
                  Developer Info (hidden in production)
                </summary>
                <pre className="text-xs mt-2 overflow-auto max-h-40 text-red-700 font-mono">
                  {error.message}
                </pre>
              </details>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <Button 
                onClick={reset}
                className="flex-1 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-violet-500/25 rounded-xl transition-all"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="flex-1 border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Trust Badges */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex items-center justify-center gap-6 relative z-10"
      >
        <GlassCard>
          <span className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Your data is safe
          </span>
        </GlassCard>
        <GlassCard>
          <span className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Auto-recovery enabled
          </span>
        </GlassCard>
      </motion.div>
    </div>
  )
}
