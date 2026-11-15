'use client'

/**
 * PROGRESS INDICATOR
 * ==================
 * Visual progress bar for multi-step flows
 * 
 * UX rationale: Users need to know:
 * - Where they are in the process
 * - How many steps remain
 * - That progress is being saved
 */

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
  labels?: string[]
  className?: string
}

export function ProgressIndicator({
  currentStep,
  totalSteps,
  labels,
  className = ''
}: ProgressIndicatorProps) {
  return (
    <div className={`w-full ${className}`}>
      {/* Progress Bars */}
      <div className="flex items-center gap-2 mb-3">
        {[...Array(totalSteps)].map((_, index) => {
          const step = index + 1
          const isComplete = step < currentStep
          const isCurrent = step === currentStep
          const isFuture = step > currentStep
          
          return (
            <div
              key={step}
              className={`
                flex-1 h-2 rounded-full transition-all duration-300
                ${isComplete ? 'bg-green-600' : ''}
                ${isCurrent ? 'bg-purple-600' : ''}
                ${isFuture ? 'bg-slate-200' : ''}
              `}
            />
          )
        })}
      </div>

      {/* Step Labels */}
      {labels ? (
        <div className="flex justify-between text-xs text-slate-600">
          {labels.map((label, index) => {
            const step = index + 1
            const isComplete = step < currentStep
            const isCurrent = step === currentStep
            
            return (
              <span
                key={step}
                className={`
                  ${isComplete ? 'text-green-600 font-medium' : ''}
                  ${isCurrent ? 'text-purple-600 font-semibold' : ''}
                `}
              >
                {label}
              </span>
            )
          })}
        </div>
      ) : (
        /* Simple Step Counter */
        <p className="text-sm text-center text-slate-600 font-medium">
          Step {currentStep} of {totalSteps}
        </p>
      )}
    </div>
  )
}

/**
 * STEP-BY-STEP PROGRESS
 * =====================
 * More detailed progress with checkmarks
 */

import { CheckCircle2, Circle } from 'lucide-react'

interface Step {
  label: string
  description?: string
}

interface StepByStepProgressProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function StepByStepProgress({
  steps,
  currentStep,
  className = ''
}: StepByStepProgressProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isComplete = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep
        const isFuture = stepNumber > currentStep
        
        return (
          <div key={stepNumber} className="flex items-start gap-3">
            {/* Step Icon */}
            <div className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
              ${isComplete ? 'bg-green-100 text-green-700' : ''}
              ${isCurrent ? 'bg-purple-100 text-purple-700' : ''}
              ${isFuture ? 'bg-slate-100 text-slate-500' : ''}
            `}>
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <span>{stepNumber}</span>
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 pt-1">
              <p className={`
                font-medium
                ${isComplete ? 'text-green-700' : ''}
                ${isCurrent ? 'text-purple-700' : ''}
                ${isFuture ? 'text-slate-500' : ''}
              `}>
                {step.label}
              </p>
              {step.description && (
                <p className="text-sm text-slate-600 mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * CIRCULAR PROGRESS
 * =================
 * For profile completion, onboarding progress, etc.
 */

interface CircularProgressProps {
  percentage: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function CircularProgress({
  percentage,
  size = 'md',
  label,
  className = ''
}: CircularProgressProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  }

  const radius = size === 'sm' ? 28 : size === 'md' ? 44 : 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className={`${sizeClasses[size]} relative ${className}`}>
      <svg className="w-full h-full transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-200"
        />
        {/* Progress Circle */}
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-purple-600 transition-all duration-500"
        />
      </svg>
      
      {/* Percentage Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">
          {Math.round(percentage)}%
        </span>
        {label && (
          <span className="text-xs text-slate-600 mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

