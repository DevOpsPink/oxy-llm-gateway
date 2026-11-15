import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Achievement {
  id: string
  user_id: string
  achievement_type: 'first_request' | 'first_saved_dollar' | 'cost_warrior'
  achievement_data: {
    cost_saved: number
    model: string
    timestamp: string
  }
  created_at: string
  celebrated: boolean
}

/**
 * Enhanced error logger for debugging
 * Handles various error types (Error, Supabase errors, unknown)
 */
function logDetailedError(context: string, error: unknown) {
  console.error(`[useAchievements] ${context}:`)
  
  // If it's a standard Error object
  if (error instanceof Error) {
    console.error('  Message:', error.message)
    console.error('  Name:', error.name)
    if (error.stack) {
      console.error('  Stack:', error.stack)
    }
  }
  
  // If it's an object (like Supabase error)
  if (error && typeof error === 'object') {
    const errorObj = error as any
    
    // Supabase-specific fields
    if ('message' in errorObj) {
      console.error('  Message:', errorObj.message)
    }
    if ('details' in errorObj) {
      console.error('  Details:', errorObj.details)
    }
    if ('hint' in errorObj) {
      console.error('  Hint:', errorObj.hint)
    }
    if ('code' in errorObj) {
      console.error('  Code:', errorObj.code)
    }
    
    // Try to stringify the entire object for full visibility
    try {
      console.error('  Full Error Object:', JSON.stringify(errorObj, null, 2))
    } catch (stringifyError) {
      console.error('  [Could not stringify error object]')
      console.error('  Raw Error:', errorObj)
    }
  } else {
    // Fallback for primitive types
    console.error('  Error:', error)
  }
}

export function useAchievements(userId?: string) {
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    async function checkForNewAchievements() {
      try {
        // Query uncelebrated achievements
        const { data, error } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', userId)
          .eq('celebrated', false)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          logDetailedError('Achievement check error (from Supabase response)', error)
          return
        }

        if (data && data.length > 0) {
          const achievement = data[0] as Achievement
          setNewAchievement(achievement)
          
          // Mark as celebrated
          await supabase
            .from('user_achievements')
            .update({ celebrated: true })
            .eq('id', achievement.id)
        }
      } catch (error) {
        logDetailedError('Achievement polling error (caught exception)', error)
      }
    }

    async function loadAllAchievements() {
      try {
        const { data, error } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          logDetailedError('Load achievements error (from Supabase response)', error)
          return
        }

        if (data) {
          setAllAchievements(data as Achievement[])
        }
      } catch (error) {
        logDetailedError('Load achievements error (caught exception)', error)
      }
    }

    // Initial check
    checkForNewAchievements()
    loadAllAchievements()

    // Poll every 3 seconds for new achievements
    const pollInterval = setInterval(checkForNewAchievements, 3000)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [userId, supabase])

  const clearNewAchievement = () => {
    setNewAchievement(null)
  }

  return {
    newAchievement,
    allAchievements,
    clearNewAchievement
  }
}

