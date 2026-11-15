'use client'

/**
 * CONTEXTUAL LOADING STATES
 * ==========================
 * Replace generic "Loading..." with context-specific messages
 * 
 * UX rationale: Users are less frustrated when they know WHAT is loading
 * - "Fetching projects..." vs "Loading..."
 * - "Calling OpenAI API (avg 2s)..." vs "Processing..."
 * - Shows expected duration when known
 */

import { Loader2, LucideIcon } from 'lucide-react'

interface ContextualLoaderProps {
  message: string
  subtext?: string
  icon?: LucideIcon
  className?: string
}

export function ContextualLoader({ 
  message, 
  subtext,
  icon: Icon,
  className = ''
}: ContextualLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {/* Spinner with optional icon overlay */}
      <div className="relative mb-4">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        {Icon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-5 h-5 text-purple-600" />
          </div>
        )}
      </div>
      
      {/* Message */}
      <p className="text-sm font-medium text-slate-900 text-center">
        {message}
      </p>
      
      {/* Subtext (optional expected duration) */}
      {subtext && (
        <p className="mt-1 text-xs text-slate-600 text-center">
          {subtext}
        </p>
      )}
    </div>
  )
}

/**
 * SKELETON LOADERS
 * ================
 * For inline loading states
 */

export function ProjectCardSkeleton() {
  return (
    <div className="border-2 border-slate-200 rounded-lg p-6 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-3/4 mb-4" />
      <div className="h-4 bg-slate-200 rounded w-1/2 mb-6" />
      <div className="space-y-3">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-5/6" />
      </div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="py-3 px-4">
        <div className="h-4 bg-slate-200 rounded w-32" />
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-slate-200 rounded w-24" />
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-slate-200 rounded w-16" />
      </td>
    </tr>
  )
}

/**
 * USAGE EXAMPLES
 * ==============
 * 
 * import { ContextualLoader } from '@/components/contextual-loader'
 * import { FolderOpen } from 'lucide-react'
 * 
 * // Simple
 * <ContextualLoader message="Fetching your projects..." />
 * 
 * // With subtext
 * <ContextualLoader 
 *   message="Calling OpenAI API..."
 *   subtext="Average response time: 2 seconds"
 * />
 * 
 * // With icon
 * <ContextualLoader 
 *   message="Fetching your projects..."
 *   icon={FolderOpen}
 * />
 * 
 * // Inline skeleton
 * {loading ? <ProjectCardSkeleton /> : <ProjectCard data={data} />}
 */

/**
 * PRE-BUILT LOADING STATES
 * =========================
 * Common contextual loaders ready to use
 */

import { FolderOpen, Key, Activity, DollarSign, Users, FileText } from 'lucide-react'

export const LoadingStates = {
  fetchingProjects: () => (
    <ContextualLoader 
      message="Fetching your projects..."
      subtext="This usually takes 1-2 seconds"
      icon={FolderOpen}
    />
  ),
  
  callingAPI: (provider: string = 'OpenAI') => (
    <ContextualLoader 
      message={`Calling ${provider} API...`}
      subtext="Average response time: 2-3 seconds"
      icon={Activity}
    />
  ),
  
  generatingAPIKey: () => (
    <ContextualLoader 
      message="Generating secure API key..."
      subtext="Encrypting with AES-256"
      icon={Key}
    />
  ),
  
  calculatingBudget: () => (
    <ContextualLoader 
      message="Calculating usage & costs..."
      subtext="Fetching latest data from Redis"
      icon={DollarSign}
    />
  ),
  
  deletingProject: () => (
    <ContextualLoader 
      message="Deleting project data..."
      subtext="This may take a moment"
      icon={FolderOpen}
    />
  ),
  
  invitingMember: () => (
    <ContextualLoader 
      message="Sending team invitation..."
      subtext="Email will arrive in 1-2 minutes"
      icon={Users}
    />
  ),
  
  exportingData: () => (
    <ContextualLoader 
      message="Exporting your data..."
      subtext="Compiling CSV file"
      icon={FileText}
    />
  ),
  
  redirectingCheckout: () => (
    <ContextualLoader 
      message="Opening secure Stripe checkout..."
      subtext="PCI-DSS Level 1 compliant (via Stripe)"
      icon={DollarSign}
    />
  )
}

