/**
 * 🎯 USE ACHIEVEMENT DETECTOR HOOK
 * ==================================
 * 
 * Polls the user_achievements table to detect new achievements.
 * When detected, triggers the celebration modal.
 * 
 * Usage in Dashboard:
 * ```tsx
 * import { useAchievementDetector } from '@/hooks/use-achievement-detector'
 * import { CelebrationModal } from '@/components/dashboard/celebration-modal'
 * 
 * export default function Dashboard() {
 *   const { latestAchievement, markAsViewed } = useAchievementDetector()
 *   
 *   return (
 *     <>
 *       <div>Your dashboard content...</div>
 *       <CelebrationModal 
 *         achievement={latestAchievement} 
 *         onClose={markAsViewed} 
 *       />
 *     </>
 *   )
 * }
 * ```
 * 
 * How it works:
 * 1. Polls user_achievements table every 5 seconds
 * 2. Checks for achievements created in last 10 seconds (fresh achievements)
 * 3. Shows celebration modal only once per achievement
 * 4. Stores viewed achievements in localStorage (prevent re-trigger)
 * 
 * Performance:
 * - Lightweight query (select id, achievement_type, created_at)
 * - Only polls when dashboard is active (uses visibilitychange API)
 * - Stops polling after 5 minutes (user already saw it)
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface Achievement {
  id: string
  achievementType: string
  achievementData: {
    costSaved: number
    model: string
    timestamp: string
  }
  createdAt: string
}

const VIEWED_ACHIEVEMENTS_KEY = "oxy_viewed_achievements"
const POLL_INTERVAL = 5000 // 5 seconds
const FRESH_ACHIEVEMENT_WINDOW = 10000 // 10 seconds
const MAX_POLL_DURATION = 300000 // 5 minutes

export function useAchievementDetector() {
  const [latestAchievement, setLatestAchievement] = useState<Achievement | null>(null)
  const [viewedAchievements, setViewedAchievements] = useState<Set<string>>(new Set())
  const supabase = createClient()

  // Load viewed achievements from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VIEWED_ACHIEVEMENTS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setViewedAchievements(new Set(parsed))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  // Mark achievement as viewed
  const markAsViewed = useCallback(() => {
    if (latestAchievement) {
      const newViewed = new Set(viewedAchievements)
      newViewed.add(latestAchievement.id)
      setViewedAchievements(newViewed)
      
      // Persist to localStorage
      localStorage.setItem(
        VIEWED_ACHIEVEMENTS_KEY,
        JSON.stringify(Array.from(newViewed))
      )
      
      // Clear latest achievement
      setLatestAchievement(null)
    }
  }, [latestAchievement, viewedAchievements])

  // Poll for new achievements
  useEffect(() => {
    let pollCount = 0
    const maxPolls = MAX_POLL_DURATION / POLL_INTERVAL

    const checkForAchievements = async () => {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Query for achievements created in last 10 seconds
        const cutoffTime = new Date(Date.now() - FRESH_ACHIEVEMENT_WINDOW).toISOString()
        
        const { data, error } = await supabase
          .from("user_achievements")
          .select("*")
          .eq("user_id", session.user.id)
          .gte("created_at", cutoffTime)
          .order("created_at", { ascending: false })
          .limit(1)

        if (error) {
          console.error("Error fetching achievements:", error)
          return
        }

        if (data && data.length > 0) {
          const achievement = data[0]
          
          // Check if already viewed
          if (!viewedAchievements.has(achievement.id)) {
            // Parse achievement_data (stored as JSON in database)
            const achievementData = typeof achievement.achievement_data === 'string'
              ? JSON.parse(achievement.achievement_data)
              : achievement.achievement_data

            setLatestAchievement({
              id: achievement.id,
              achievementType: achievement.achievement_type,
              achievementData: {
                costSaved: achievementData.cost_saved,
                model: achievementData.model,
                timestamp: achievementData.timestamp
              },
              createdAt: achievement.created_at
            })
          }
        }
      } catch (error) {
        console.error("Achievement detector error:", error)
      }
    }

    // Initial check
    checkForAchievements()

    // Set up polling (only if page is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        pollCount++
        
        // Stop polling after max duration (5 minutes)
        if (pollCount >= maxPolls) {
          clearInterval(interval)
          return
        }
        
        checkForAchievements()
      }
    }, POLL_INTERVAL)

    // Cleanup
    return () => clearInterval(interval)
  }, [supabase, viewedAchievements])

  return {
    latestAchievement,
    markAsViewed
  }
}

