/**
 * First Request Celebration Hook
 * ================================
 * 
 * Polls for user achievements and triggers celebration modal
 * when first API request is detected.
 * 
 * Usage:
 * ```tsx
 * const { showCelebration, dismissCelebration, achievement } = useFirstRequestCelebration()
 * 
 * {showCelebration && (
 *   <CelebrationModal achievement={achievement} onClose={dismissCelebration} />
 * )}
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Achievement {
  id: string
  user_id: string
  achievement_type: string
  achievement_data: {
    cost_saved: number
    model: string
    timestamp: string
  }
  created_at: string
}

interface UseFirstRequestCelebrationReturn {
  showCelebration: boolean
  achievement: Achievement | null
  dismissCelebration: () => void
  checkNow: () => Promise<void>
}

export function useFirstRequestCelebration(): UseFirstRequestCelebrationReturn {
  const [showCelebration, setShowCelebration] = useState(false)
  const [achievement, setAchievement] = useState<Achievement | null>(null)
  const lastCheckedRef = useRef<string | null>(null)
  const supabase = createClient()
  
  // Check for first_request achievement
  const checkForAchievement = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      
      const userId = session.user.id
      
      // Query user_achievements for first_request type
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .eq('achievement_type', 'first_request')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows, which is expected if no achievement yet
        console.error('Achievement check error:', error)
        return
      }
      
      if (data) {
        // Check if this is a new achievement (not already seen)
        const achievementId = data.id
        const seenAchievements = localStorage.getItem('oxy_seen_achievements')
        const seen = seenAchievements ? JSON.parse(seenAchievements) : []
        
        if (!seen.includes(achievementId)) {
          // New achievement! Show celebration
          setAchievement(data as Achievement)
          setShowCelebration(true)
          
          // Mark as seen
          seen.push(achievementId)
          localStorage.setItem('oxy_seen_achievements', JSON.stringify(seen))
        }
      }
    } catch (err) {
      console.error('Failed to check for achievements:', err)
    }
  }, [supabase])
  
  // Poll for achievements on mount and every 10 seconds
  useEffect(() => {
    // Initial check
    checkForAchievement()
    
    // Poll every 10 seconds (lightweight query)
    const interval = setInterval(checkForAchievement, 10000)
    
    return () => clearInterval(interval)
  }, [checkForAchievement])
  
  // Listen for real-time achievement inserts
  useEffect(() => {
    const channel = supabase
      .channel('achievements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `achievement_type=eq.first_request`
        },
        (payload) => {
          // New achievement detected via real-time
          const newAchievement = payload.new as Achievement
          
          // Verify it's for the current user
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id === newAchievement.user_id) {
              setAchievement(newAchievement)
              setShowCelebration(true)
              
              // Mark as seen
              const seenAchievements = localStorage.getItem('oxy_seen_achievements')
              const seen = seenAchievements ? JSON.parse(seenAchievements) : []
              seen.push(newAchievement.id)
              localStorage.setItem('oxy_seen_achievements', JSON.stringify(seen))
            }
          })
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])
  
  const dismissCelebration = useCallback(() => {
    setShowCelebration(false)
  }, [])
  
  return {
    showCelebration,
    achievement,
    dismissCelebration,
    checkNow: checkForAchievement
  }
}

export default useFirstRequestCelebration

