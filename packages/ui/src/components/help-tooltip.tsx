'use client'

/**
 * HELP TOOLTIP COMPONENT
 * =======================
 * Contextual help everywhere
 * 
 * Where to use:
 * - Form fields that need explanation
 * - Technical terms
 * - Configuration options
 * - Plan limits
 */

import { HelpCircle, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HelpTooltipProps {
  content: string | React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function HelpTooltip({ 
  content, 
  side = 'top',
  className = ''
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            type="button"
            className={`inline-flex items-center justify-center transition-colors ${className}`}
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4 text-slate-500 hover:text-slate-600" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="text-sm">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * INFO TOOLTIP (Blue variant)
 * ============================
 * For informational (not help) tooltips
 */

export function InfoTooltip({ 
  content, 
  side = 'top'
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            type="button"
            className="inline-flex items-center justify-center"
            aria-label="Information"
          >
            <Info className="h-4 w-4 text-blue-500 hover:text-blue-600" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs bg-blue-50 border-blue-200">
          <div className="text-sm text-blue-900">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * PRE-BUILT TOOLTIPS
 * ===================
 * Common tooltips ready to use
 */

export const HelpTooltips = {
  // Budget & Billing
  budgetLimit: () => (
    <HelpTooltip content="Maximum amount you'll spend per month. API requests stop when limit is reached to prevent surprise bills." />
  ),
  
  currentSpend: () => (
    <HelpTooltip content="Total amount spent this billing period. Resets on the 1st of each month." />
  ),
  
  // API Keys
  apiKeyFormat: (provider: 'OpenAI' | 'Anthropic' | 'Google') => {
    const formats = {
      OpenAI: 'sk-proj-...',
      Anthropic: 'sk-ant-api03-...',
      Google: 'AIza...'
    }
    return (
      <HelpTooltip content={`Your ${provider} API key should start with "${formats[provider]}". Find it in your ${provider} dashboard.`} />
    )
  },
  
  apiKeyEncryption: () => (
    <HelpTooltip content="Your API keys are encrypted with AES-256 and stored in Supabase Vault. We never see your keys in plain text." />
  ),
  
  // Projects
  projectName: () => (
    <HelpTooltip content="Choose a descriptive name like 'Production API' or 'Development'. This helps organize your requests and budgets." />
  ),
  
  projectDeletion: () => (
    <HelpTooltip content="Deleting a project removes all associated data including API keys, usage logs, and budget settings. This action cannot be undone." />
  ),
  
  // Team
  teamRoleOwner: () => (
    <HelpTooltip content="Owner: Full access. Can manage billing, delete organization, and invite/remove members." />
  ),
  
  teamRoleAdmin: () => (
    <HelpTooltip content="Admin: Can create projects, manage API keys, and invite members. Cannot delete organization or manage billing." />
  ),
  
  teamRoleMember: () => (
    <HelpTooltip content="Member: Can view projects and make API requests. Cannot modify settings or invite others." />
  ),
  
  // Plan limits
  apiRequests: () => (
    <HelpTooltip content="Each call to OpenAI, Anthropic, or Google counts as one request. Streaming responses count as one request." />
  ),
  
  overage: () => (
    <HelpTooltip content="Requests beyond your plan tier's monthly cap are rejected until the cap resets, unless the operator raises the tier or bills overage through the optional Stripe module." />
  ),
  
  // Features
  dlpScanner: () => (
    <HelpTooltip content={
      <div>
        <p className="font-semibold mb-1">DLP (Data Loss Prevention)</p>
        <p>Automatically scans prompts for API keys, secrets, and PII before sending to AI. Prevents accidental leaks.</p>
      </div>
    } />
  ),
  
  deadKeyDetection: () => (
    <HelpTooltip content="Automatically detects when an API key is invalid or expired and disables it to prevent wasted requests." />
  ),
  
  rowLevelSecurity: () => (
    <HelpTooltip content="RLS (Row-Level Security) ensures your data is isolated from other organizations. PostgreSQL enforces access at the database level." />
  ),
  
  atomicBudget: () => (
    <HelpTooltip content={
      <div>
        <p className="font-semibold mb-1">Atomic Budget Control</p>
        <p>Uses Redis Lua scripts to ensure budget checks happen atomically. Prevents race conditions and budget overruns.</p>
      </div>
    } />
  )
}

/**
 * USAGE EXAMPLES
 * ==============
 * 
 * // With Label
 * <Label>
 *   Budget Limit <HelpTooltips.budgetLimit />
 * </Label>
 * 
 * // Inline
 * <p>
 *   DLP Scanner <HelpTooltips.dlpScanner />
 * </p>
 * 
 * // Custom content
 * <HelpTooltip content="This is a helpful message" />
 * 
 * // Multi-line content
 * <HelpTooltip content={
 *   <div>
 *     <p className="font-semibold">Title</p>
 *     <p>Description here</p>
 *   </div>
 * } />
 */

