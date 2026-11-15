'use client'

/**
 * Plan-limit notice modal.
 *
 * Shown when an organisation crosses the monthly request cap defined by its
 * `plan_tier`. Plan tiers are quota levels the operator assigns in the
 * database; the cap is a policy value the operator owns.
 */

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type PlanTier = 'free' | 'starter' | 'growth' | 'business' | 'enterprise'

interface PlanLimitModalProps {
  currentPlan: PlanTier
  isOpen: boolean
  onClose: () => void
}

// Next tier with a higher request cap. Keep in sync with PLAN_LIMITS in
// packages/engine/routes/billing.py.
const NEXT_TIER: Record<PlanTier, { name: string; requests: string }> = {
  free: { name: 'Starter', requests: '500K / month' },
  starter: { name: 'Growth', requests: '2M / month' },
  growth: { name: 'Business', requests: '10M / month' },
  business: { name: 'Enterprise', requests: 'no cap' },
  enterprise: { name: 'Enterprise', requests: 'no cap' },
}

export function PlanLimitModal({ currentPlan, isOpen, onClose }: PlanLimitModalProps) {
  const router = useRouter()
  const next = NEXT_TIER[currentPlan]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Monthly request cap reached</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Plan: <span className="font-medium text-slate-700">{currentPlan}</span>
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Your organisation has used its full monthly allowance on the{' '}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{currentPlan}</code> plan.
            The cap resets on the first of next month (UTC).
          </p>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Options
            </p>
            <ul className="mt-2 text-sm text-slate-700 space-y-2">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                <span>
                  Ask the operator of this deployment to raise the cap by changing this org&apos;s{' '}
                  <code className="text-xs bg-white border border-slate-200 px-1 py-0.5 rounded">plan_tier</code>{' '}
                  in Postgres (e.g. to <code className="text-xs bg-white border border-slate-200 px-1 py-0.5 rounded">{next.name.toLowerCase()}</code> → {next.requests}).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                <span>Wait for the monthly reset on the 1st.</span>
              </li>
            </ul>
          </div>

          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Dismiss
            </button>
            <div className="flex gap-2">
              <Link
                href="https://github.com/heyvaldemar/oxy-llm-gateway/blob/main/docs/getting-started/free-tier.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  Docs
                  <ExternalLink className="h-3 w-3 ml-1.5" />
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => {
                  router.push('/pricing')
                  onClose()
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                View plan limits
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
