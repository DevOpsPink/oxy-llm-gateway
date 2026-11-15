'use client'

/**
 * ERROR BOUNDARY COMPONENT (Oxy Brand Edition)
 * ============================================
 * 
 * Error handling for React components.
 * Styled to match Oxy branding for consistency.
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home, Cpu, ShieldCheck } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught error:', error, errorInfo)
    }
    
    this.setState({ errorInfo })
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
    
    // Send to Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: { componentStack: errorInfo.componentStack }
        },
        level: 'error',
        tags: { error_boundary: 'true' }
      })
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI - Oxy branded
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4 py-12 sm:px-6 lg:px-8 relative">
          {/* Mesh gradient background */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="absolute top-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>
          
          {/* Logo Header */}
          <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center relative z-10">
            <div className="mx-auto h-14 w-14 bg-linear-to-br from-violet-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Cpu className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-display font-bold tracking-tight text-slate-900">
              Oxy Control Plane
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              AI Control Plane • Kill Switch for Agents
            </p>
          </div>

          {/* Error Card */}
          <div className="w-full max-w-md relative z-10">
            <Card className="shadow-xl border-slate-200/50 bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center space-y-4 pb-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-linear-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <AlertTriangle className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-2xl font-display font-bold text-slate-900 mb-2">
                    Something Went Wrong
                  </CardTitle>
                  <CardDescription className="text-base text-slate-600">
                    We hit a snag. Your data is safe.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-800">
                    The error has been logged. Try refreshing or head back to the dashboard.
                  </p>
                </div>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="bg-red-50 p-3 rounded-xl border border-red-200">
                    <summary className="text-xs font-semibold text-red-600 cursor-pointer">
                      Developer Info (hidden in production)
                    </summary>
                    <pre className="text-xs mt-2 overflow-auto max-h-40 text-red-700 font-mono">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
              </CardContent>

              <CardFooter className="flex gap-3 pt-2">
                <Button 
                  onClick={this.handleReload}
                  className="flex-1 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold shadow-lg shadow-violet-500/25 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1 border-slate-200 hover:border-violet-400 hover:text-violet-700 rounded-xl"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Trust Badges */}
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500 relative z-10">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              Your data is safe
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              Auto-recovery enabled
            </span>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
  const [, setError] = React.useState()
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}
