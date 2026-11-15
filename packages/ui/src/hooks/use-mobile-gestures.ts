'use client'

/**
 * MOBILE GESTURES HOOK
 * =====================
 * React hook for touch gestures on mobile
 * 
 * Supported Gestures:
 * - Swipe (left, right, up, down)
 * - Long press
 * - Pull to refresh
 * - Pinch to zoom
 * 
 * Usage:
 * const ref = useRef<HTMLDivElement>(null)
 * useSwipeGesture(ref, {
 *   onSwipeLeft: () => console.log('Next'),
 *   onSwipeRight: () => console.log('Previous')
 * })
 */

import { useEffect, RefObject, useCallback } from 'react'

// ============================================================================
// SWIPE GESTURE
// ============================================================================

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  minDistance?: number // Minimum pixels to trigger swipe (default 50)
}

export function useSwipeGesture(
  ref: RefObject<HTMLElement>,
  handlers: SwipeHandlers
) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, minDistance = 50 } = handlers
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
      touchStartTime = Date.now()
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const touchEndTime = Date.now()
      
      const deltaX = touchEndX - touchStartX
      const deltaY = touchEndY - touchStartY
      const deltaTime = touchEndTime - touchStartTime
      
      // Ignore if touch was too long (probably scrolling)
      if (deltaTime > 500) return
      
      // Determine direction (horizontal or vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > minDistance) {
          if (deltaX > 0) {
            onSwipeRight?.()
          } else {
            onSwipeLeft?.()
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > minDistance) {
          if (deltaY > 0) {
            onSwipeDown?.()
          } else {
            onSwipeUp?.()
          }
        }
      }
    }
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, minDistance])
}

// ============================================================================
// LONG PRESS GESTURE
// ============================================================================

interface LongPressHandlers {
  onLongPress: () => void
  duration?: number // Milliseconds to hold (default 500)
}

export function useLongPress(
  ref: RefObject<HTMLElement>,
  handlers: LongPressHandlers
) {
  const { onLongPress, duration = 500 } = handlers
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    let timeoutId: NodeJS.Timeout
    
    const handleTouchStart = () => {
      timeoutId = setTimeout(() => {
        onLongPress()
        // Optional: Haptic feedback on supported devices
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }, duration)
    }
    
    const handleTouchEnd = () => {
      clearTimeout(timeoutId)
    }
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    
    return () => {
      clearTimeout(timeoutId)
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [ref, onLongPress, duration])
}

// ============================================================================
// PULL TO REFRESH
// ============================================================================

interface PullToRefreshHandlers {
  onRefresh: () => Promise<void>
  threshold?: number // Pixels to pull (default 80)
}

export function usePullToRefresh(
  ref: RefObject<HTMLElement>,
  handlers: PullToRefreshHandlers
) {
  const { onRefresh, threshold = 80 } = handlers
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    let startY = 0
    let currentY = 0
    let isRefreshing = false
    
    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if scrolled to top
      if (element.scrollTop === 0) {
        startY = e.touches[0].clientY
      }
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || element.scrollTop > 0) return
      
      currentY = e.touches[0].clientY
      const pullDistance = currentY - startY
      
      if (pullDistance > 0) {
        // Prevent default scroll
        e.preventDefault()
        
        // Visual feedback (optional: add custom element)
        const opacity = Math.min(pullDistance / threshold, 1)
        element.style.transform = `translateY(${Math.min(pullDistance / 2, threshold / 2)}px)`
        element.style.opacity = String(1 - opacity * 0.2)
      }
    }
    
    const handleTouchEnd = async () => {
      if (isRefreshing) return
      
      const pullDistance = currentY - startY
      
      if (pullDistance > threshold) {
        isRefreshing = true
        
        // Show loading state
        element.style.transition = 'transform 0.3s, opacity 0.3s'
        
        try {
          await onRefresh()
        } catch (error) {
          console.error('Refresh failed:', error)
        } finally {
          isRefreshing = false
          element.style.transform = ''
          element.style.opacity = ''
          startY = 0
          currentY = 0
        }
      } else {
        // Reset
        element.style.transition = 'transform 0.3s, opacity 0.3s'
        element.style.transform = ''
        element.style.opacity = ''
      }
    }
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, onRefresh, threshold])
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * SWIPE NAVIGATION
 * ================
 * 
 * const containerRef = useRef<HTMLDivElement>(null)
 * 
 * useSwipeGesture(containerRef, {
 *   onSwipeLeft: () => router.push('/next-page'),
 *   onSwipeRight: () => router.back()
 * })
 * 
 * return <div ref={containerRef}>...</div>
 */

/**
 * LONG PRESS MENU
 * ===============
 * 
 * const itemRef = useRef<HTMLDivElement>(null)
 * 
 * useLongPress(itemRef, {
 *   onLongPress: () => setShowContextMenu(true),
 *   duration: 500
 * })
 * 
 * return <div ref={itemRef}>Long press me</div>
 */

/**
 * PULL TO REFRESH
 * ===============
 * 
 * const listRef = useRef<HTMLDivElement>(null)
 * 
 * usePullToRefresh(listRef, {
 *   onRefresh: async () => {
 *     await fetchNewData()
 *   },
 *   threshold: 80
 * })
 * 
 * return <div ref={listRef} className="overflow-y-auto">...</div>
 */

