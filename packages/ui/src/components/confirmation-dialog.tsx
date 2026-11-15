'use client'

/**
 * CONFIRMATION DIALOG COMPONENT
 * ==============================
 * Prevents accidental destructive actions
 * 
 * Use Cases:
 * - Delete project
 * - Revoke API key
 * - Remove team member
 * - Cancel subscription
 * 
 * UX rationale: Friction = protection
 * - Forces user to think twice
 * - Shows consequences clearly
 * - Prevents rage clicks
 */

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

interface ConfirmationDialogProps {
  trigger: React.ReactNode
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  variant?: 'destructive' | 'warning' | 'default'
  requiresTypedConfirmation?: boolean
  confirmationWord?: string
}

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'destructive',
  requiresTypedConfirmation = false,
  confirmationWord = 'DELETE'
}: ConfirmationDialogProps) {
  const [open, setOpen] = useState(false)
  const [typedConfirmation, setTypedConfirmation] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    // If typed confirmation required, validate it
    if (requiresTypedConfirmation && typedConfirmation !== confirmationWord) {
      return
    }

    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
      setTypedConfirmation('')
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setLoading(false)
    }
  }

  const isConfirmDisabled = requiresTypedConfirmation 
    ? typedConfirmation !== confirmationWord 
    : false

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          {/* Warning Icon for destructive actions */}
          {variant === 'destructive' && (
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          )}
          
          <AlertDialogTitle className="text-xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Typed Confirmation (for extra-dangerous actions) */}
        {requiresTypedConfirmation && (
          <div className="my-4 space-y-2">
            <Label htmlFor="confirmation" className="text-sm font-medium">
              Type <strong className="font-mono text-red-600">{confirmationWord}</strong> to confirm:
            </Label>
            <Input
              id="confirmation"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={confirmationWord}
              className={`font-mono ${
                typedConfirmation && typedConfirmation !== confirmationWord 
                  ? 'border-red-500' 
                  : ''
              }`}
              autoComplete="off"
            />
            {typedConfirmation && typedConfirmation !== confirmationWord && (
              <p className="text-xs text-red-600">
                Please type exactly: {confirmationWord}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled || loading}
            className={
              variant === 'destructive' 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' 
                : ''
            }
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * PRE-BUILT CONFIRMATION DIALOGS
 * ===============================
 * Common confirmation variants for reuse
 */

interface DeleteProjectDialogProps {
  projectName: string
  onConfirm: () => void | Promise<void>
}

export function DeleteProjectDialog({ projectName, onConfirm }: DeleteProjectDialogProps) {
  return (
    <ConfirmationDialog
      trigger={
        <Button variant="destructive" size="sm">
          Delete Project
        </Button>
      }
      title="Delete Project?"
      description={`This will permanently delete "${projectName}" and all associated data including API keys, usage logs, and budget settings. This action cannot be undone.`}
      confirmText="Yes, Delete Project"
      cancelText="Cancel"
      onConfirm={onConfirm}
      variant="destructive"
      requiresTypedConfirmation={true}
      confirmationWord="DELETE"
    />
  )
}

interface RevokeAPIKeyDialogProps {
  keyName: string
  onConfirm: () => void | Promise<void>
}

export function RevokeAPIKeyDialog({ keyName, onConfirm }: RevokeAPIKeyDialogProps) {
  return (
    <ConfirmationDialog
      trigger={
        <Button variant="destructive" size="sm">
          Revoke Key
        </Button>
      }
      title="Revoke API Key?"
      description={`Are you sure you want to revoke "${keyName}"? Any applications using this key will immediately stop working. This action cannot be undone.`}
      confirmText="Yes, Revoke Key"
      cancelText="Cancel"
      onConfirm={onConfirm}
      variant="destructive"
    />
  )
}

interface RemoveTeamMemberDialogProps {
  memberName: string
  memberEmail: string
  onConfirm: () => void | Promise<void>
}

export function RemoveTeamMemberDialog({ memberName, memberEmail, onConfirm }: RemoveTeamMemberDialogProps) {
  return (
    <ConfirmationDialog
      trigger={
        <Button variant="destructive" size="sm">
          Remove Member
        </Button>
      }
      title="Remove Team Member?"
      description={`Remove ${memberName} (${memberEmail}) from your organization? They will immediately lose access to all projects and data.`}
      confirmText="Yes, Remove Member"
      cancelText="Cancel"
      onConfirm={onConfirm}
      variant="destructive"
    />
  )
}

interface CancelSubscriptionDialogProps {
  onConfirm: () => void | Promise<void>
}

export function CancelSubscriptionDialog({ onConfirm }: CancelSubscriptionDialogProps) {
  return (
    <ConfirmationDialog
      trigger={
        <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
          Cancel Subscription
        </Button>
      }
      title="Cancel Subscription?"
      description="Your subscription will be canceled at the end of your billing period. You can resubscribe anytime."
      confirmText="Yes, Cancel Subscription"
      cancelText="Keep Subscription"
      onConfirm={onConfirm}
      variant="destructive"
    />
  )
}

