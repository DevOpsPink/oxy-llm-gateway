'use client'

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { WifiOff, RefreshCw } from "lucide-react"

export default function OfflinePage() {
  const router = useRouter()
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-slate-500 dark:text-slate-500" />
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          You're Offline
        </h1>
        
        {/* Description */}
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
          No internet connection detected. Please check your network settings and try again.
        </p>
        
        {/* Status indicators */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-8 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-500">
                Internet Connection
              </span>
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                Offline
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-500">
                Cached Data
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                Available
              </span>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            className="w-full"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            View Cached Dashboard
          </Button>
        </div>
        
        {/* Help text */}
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-500">
          Some features may be limited while offline. You can still view cached data from your last visit.
        </p>
      </div>
    </div>
  )
}

