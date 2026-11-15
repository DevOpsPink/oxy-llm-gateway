'use client'

/**
 * EMPTY STATE COMPONENT
 * =====================
 * Beautiful empty states with CTAs to improve onboarding
 * 
 * UX rationale: Empty states are opportunities, not failures
 * - Guide users to next action
 * - Make UI feel friendly, not broken
 * - Reduce confusion and support tickets
 */

import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {/* Icon */}
      <div className="w-16 h-16 bg-linear-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {title}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-slate-600 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      
      {/* Action (optional CTA button) */}
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  )
}

/**
 * PRE-BUILT EMPTY STATES
 * ======================
 * Common empty state variants for reuse
 */

import { FolderOpen, Key, Users, Activity, FileText } from 'lucide-react'

export function EmptyProjects({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No projects yet"
      description="Create your first project to start tracking AI costs and setting budgets."
      action={
        <Button onClick={onCreate} size="lg">
          <FolderOpen className="mr-2 h-4 w-4" />
          Create Your First Project
        </Button>
      }
    />
  )
}

export function EmptyAPIKeys({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={Key}
      title="No API keys created"
      description="Generate your first API key to start making requests through Oxy Engine."
      action={
        <Button onClick={onCreate} size="lg">
          <Key className="mr-2 h-4 w-4" />
          Generate API Key
        </Button>
      }
    />
  )
}

export function EmptyTeamMembers({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No team members yet"
      description="Invite team members to collaborate on projects and share access to the AI Control Plane."
      action={
        <Button onClick={onInvite} size="lg">
          <Users className="mr-2 h-4 w-4" />
          Invite Team Member
        </Button>
      }
    />
  )
}

export function EmptyRequestLogs() {
  return (
    <EmptyState
      icon={Activity}
      title="No requests yet"
      description="Once you start making API calls, you'll see real-time request logs here with costs, tokens, and response times."
    />
  )
}

export function EmptyDocumentation() {
  return (
    <EmptyState
      icon={FileText}
      title="Getting started"
      description="Read the quickstart, or ask in GitHub Discussions."
      action={
        <Button variant="outline" asChild>
          <a href="https://github.com/heyvaldemar/oxy-llm-gateway/discussions" target="_blank" rel="noopener noreferrer">
            <FileText className="mr-2 h-4 w-4" />
            Ask on GitHub
          </a>
        </Button>
      }
    />
  )
}

