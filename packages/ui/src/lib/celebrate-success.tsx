'use client'

/**
 * SUCCESS CELEBRATION LIBRARY
 * ============================
 * Toast + confetti helpers for successful actions.
 */

import { toast } from 'sonner'
import confetti from 'canvas-confetti'

/**
 * SUCCESS MESSAGES WITH PERSONALITY
 * ==================================
 * Each message has:
 * - Emoji for visual impact
 * - Bold main message
 * - Helpful next step
 */

export const celebrateSuccess = {
  /**
   * PROJECT MANAGEMENT
   */
  projectCreated: (projectName: string) => {
    toast.success(
      <div>
        <p className="font-semibold">🎉 Project "{projectName}" created!</p>
        <p className="text-sm text-slate-600 mt-1">Start making API calls now</p>
      </div>,
      { duration: 4000 }
    )
  },
  
  projectDeleted: () => {
    toast.success(
      <div>
        <p className="font-semibold">✅ Project deleted successfully</p>
        <p className="text-sm text-slate-600 mt-1">All data has been removed</p>
      </div>
    )
  },
  
  /**
   * BUDGET MANAGEMENT
   */
  budgetSaved: (limit: number) => {
    toast.success(
      <div>
        <p className="font-semibold">✅ Budget limit set to ${limit}!</p>
        <p className="text-sm text-slate-600 mt-1">We'll alert you at 80% usage</p>
      </div>,
      { duration: 4000 }
    )
  },
  
  budgetAlert: (current: number, limit: number) => {
    const percentage = Math.round((current / limit) * 100)
    toast.warning(
      <div>
        <p className="font-semibold">⚠️ Budget Alert: {percentage}% used</p>
        <p className="text-sm text-slate-600 mt-1">
          ${current} of ${limit} spent this month
        </p>
      </div>,
      { duration: 6000 }
    )
  },
  
  /**
   * API KEYS
   */
  apiKeyAdded: (provider: string) => {
    toast.success(
      <div>
        <p className="font-semibold">🔐 {provider} API key saved!</p>
        <p className="text-sm text-slate-600 mt-1">Encrypted with AES-256 and ready to use</p>
      </div>,
      { duration: 4000 }
    )
  },
  
  apiKeyRevoked: () => {
    toast.success(
      <div>
        <p className="font-semibold">✅ API key revoked</p>
        <p className="text-sm text-slate-600 mt-1">No further requests will be authorized</p>
      </div>
    )
  },
  
  /**
   * FIRST MILESTONES (Extra special!)
   */
  firstAPICall: async () => {
    // Confetti animation
    await confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#2563eb', '#10b981']
    })
    
    toast.success(
      <div className="flex items-start gap-3">
        <div className="text-3xl">🚀</div>
        <div>
          <p className="font-bold text-lg">Your first AI request!</p>
          <p className="text-sm text-slate-600 mt-1">
            You're officially live. Time to build something amazing.
          </p>
        </div>
      </div>,
      { duration: 6000 }
    )
  },
  
  firstProjectCreated: () => {
    toast.success(
      <div className="flex items-start gap-3">
        <div className="text-2xl">🎊</div>
        <div>
          <p className="font-bold text-lg">Welcome to Oxy Engine!</p>
          <p className="text-sm text-slate-600 mt-1">
            Your first project is ready. Add an API key to get started.
          </p>
        </div>
      </div>,
      { duration: 5000 }
    )
  },
  
  /**
   * TEAM MANAGEMENT
   */
  memberInvited: (email: string) => {
    toast.success(
      <div>
        <p className="font-semibold">📧 Invitation sent!</p>
        <p className="text-sm text-slate-600 mt-1">
          {email} will receive their invite in 1-2 minutes
        </p>
      </div>,
      { duration: 4000 }
    )
  },
  
  memberRemoved: () => {
    toast.success(
      <div>
        <p className="font-semibold">✅ Team member removed</p>
        <p className="text-sm text-slate-600 mt-1">They no longer have access</p>
      </div>
    )
  },
  
  /**
   * SUBSCRIPTION
   */
  subscriptionCreated: (plan: string) => {
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#7c3aed', '#2563eb', '#fbbf24']
    })
    
    toast.success(
      <div className="flex items-start gap-3">
        <div className="text-3xl">🎉</div>
        <div>
          <p className="font-bold text-lg">Welcome to {plan}!</p>
          <p className="text-sm text-slate-600 mt-1">
            Your subscription is active. The plan&apos;s limits now apply.
          </p>
        </div>
      </div>,
      { duration: 6000 }
    )
  },
  
  subscriptionChanged: (fromPlan: string, toPlan: string) => {
    toast.success(
      <div>
        <p className="font-semibold">Plan changed to {toPlan}</p>
        <p className="text-sm text-slate-600 mt-1">
          Your new limits are now active
        </p>
      </div>,
      { duration: 4000 }
    )
  },
  
  /**
   * SETTINGS
   */
  settingsSaved: () => {
    toast.success(
      <div>
        <p className="font-semibold">✅ Settings saved</p>
        <p className="text-sm text-slate-600 mt-1">Your changes are now active</p>
      </div>
    )
  },
  
  profileUpdated: () => {
    toast.success(
      <div>
        <p className="font-semibold">✅ Profile updated</p>
        <p className="text-sm text-slate-600 mt-1">Your information has been saved</p>
      </div>
    )
  },
  
  /**
   * DATA EXPORT
   */
  dataExported: () => {
    toast.success(
      <div>
        <p className="font-semibold">📥 Data export complete!</p>
        <p className="text-sm text-slate-600 mt-1">Check your downloads folder</p>
      </div>,
      { duration: 5000 }
    )
  },
  
  /**
   * ACHIEVEMENTS (Gamification)
   */
  achievement: (title: string, description: string, emoji: string = '🏆') => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    })
    
    toast.success(
      <div className="flex items-start gap-3">
        <div className="text-2xl">{emoji}</div>
        <div>
          <p className="font-bold">Achievement Unlocked!</p>
          <p className="font-semibold mt-1">{title}</p>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
      </div>,
      { duration: 6000 }
    )
  },
  
  /**
   * MILESTONES
   */
  milestone: (milestone: string, description: string) => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })
    
    toast.success(
      <div className="flex items-start gap-3">
        <div className="text-3xl">🎯</div>
        <div>
          <p className="font-bold text-lg">{milestone}</p>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
      </div>,
      { duration: 6000 }
    )
  }
}

/**
 * PRE-DEFINED MILESTONES
 * =======================
 * Track and celebrate key milestones
 */

export const milestones = {
  requests100: () => celebrateSuccess.milestone(
    '100 API Requests! 🎉',
    'You\'re getting the hang of this!'
  ),
  
  requests1000: () => celebrateSuccess.milestone(
    '1,000 API Requests! 🚀',
    'Your project is growing fast!'
  ),
  
  requests10000: () => celebrateSuccess.milestone(
    '10,000 API Requests! 🔥',
    'You\'re scaling like a pro!'
  ),
  
  cost100: () => celebrateSuccess.milestone(
    '$100 Saved! 💰',
    'Oxy Engine has prevented $100 in waste'
  ),
  
  cost1000: () => celebrateSuccess.milestone(
    '$1,000 Saved! 🎊',
    'You\'ve saved serious money with budget controls'
  ),
  
  dlpBlock: () => celebrateSuccess.achievement(
    'Security Hero',
    'You prevented an API key leak with DLP scanning',
    '🛡️'
  ),
  
  weekStreak: () => celebrateSuccess.achievement(
    '7-Day Streak',
    'You\'ve used Oxy Engine every day this week',
    '🔥'
  )
}

/**
 * USAGE
 * =====
 * 
 * import { celebrateSuccess } from '@/lib/celebrate-success'
 * 
 * // After creating project
 * celebrateSuccess.projectCreated('Production API')
 * 
 * // After first API call
 * await celebrateSuccess.firstAPICall()
 * 
 * // Custom achievement
 * celebrateSuccess.achievement('Power User', 'Made 1,000 requests!', '⚡')
 */

