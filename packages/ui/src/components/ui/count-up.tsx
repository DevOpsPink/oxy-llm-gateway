"use client"

/**
 * COUNT-UP COMPONENT
 * ==================
 * Animates a number from 0 to its value with ease-out timing.
 * 
 * Performance:
 * - Uses requestAnimationFrame for 60fps smoothness
 * - GPU-accelerated (transform/opacity only)
 * - Respects prefers-reduced-motion
 * 
 * Usage:
 * <CountUp value={1247} duration={2000} /> // Counts from 0 to 1247 in 2 seconds
 * <CountUp value={49.99} prefix="$" decimals={2} /> // $0.00 → $49.99
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion'

interface CountUpProps {
  /** Target value to count up to */
  value: number
  /** Duration of animation in milliseconds (default: 2000ms) */
  duration?: number
  /** Number of decimal places to display (default: 0) */
  decimals?: number
  /** Prefix to display before number (e.g., "$") */
  prefix?: string
  /** Suffix to display after number (e.g., "%") */
  suffix?: string
  /** Starting value (default: 0) */
  from?: number
  /** Additional CSS classes */
  className?: string
  /** Callback when animation completes */
  onComplete?: () => void
  /** Whether to animate on mount (default: true) */
  animateOnMount?: boolean
  /** Separator for thousands (default: ",") */
  separator?: string
}

/**
 * Ease-out cubic function
 * Fast start, slow end - creates ANTICIPATION → SATISFACTION
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Ease-out expo function (more dramatic)
 * Even faster start, even slower end
 */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

/**
 * Format number with separators and decimals
 */
function formatNumber(
  value: number,
  decimals: number,
  separator: string
): string {
  const fixed = value.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  
  // Add thousand separators
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  
  return decPart ? `${withSeparators}.${decPart}` : withSeparators
}

export function CountUp({
  value,
  duration = 2000,
  decimals = 0,
  prefix = '',
  suffix = '',
  from = 0,
  className = '',
  onComplete,
  animateOnMount = true,
  separator = ','
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(animateOnMount ? from : value)
  const [hasAnimated, setHasAnimated] = useState(false)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const elementRef = useRef<HTMLSpanElement>(null)

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false

  const animate = useCallback(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value)
      onComplete?.()
      return
    }

    const step = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      
      // Apply ease-out for DOPAMINE effect
      const easedProgress = easeOutExpo(progress)
      
      // Calculate current value
      const currentValue = from + (value - from) * easedProgress
      setDisplayValue(currentValue)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setDisplayValue(value) // Ensure exact final value
        setHasAnimated(true)
        onComplete?.()
      }
    }

    frameRef.current = requestAnimationFrame(step)
  }, [value, from, duration, prefersReducedMotion, onComplete])

  // Animate on mount or when value changes
  useEffect(() => {
    if (animateOnMount || hasAnimated) {
      // Reset and start animation
      startTimeRef.current = null
      animate()
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [value, animate, animateOnMount, hasAnimated])

  // Intersection Observer for animate-on-scroll
  useEffect(() => {
    if (!animateOnMount && elementRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasAnimated) {
              animate()
            }
          })
        },
        { threshold: 0.1 }
      )

      observer.observe(elementRef.current)
      return () => observer.disconnect()
    }
  }, [animate, animateOnMount, hasAnimated])

  const formattedValue = formatNumber(displayValue, decimals, separator)

  return (
    <span 
      ref={elementRef}
      className={`tabular-nums ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {prefix}{formattedValue}{suffix}
    </span>
  )
}

/**
 * SPRING-BASED COUNT UP
 * =====================
 * Uses Framer Motion's spring physics for more natural motion.
 * Better for values that might change frequently.
 */
export function CountUpSpring({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  separator = ','
}: Omit<CountUpProps, 'duration' | 'from' | 'onComplete' | 'animateOnMount'>) {
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })
  
  const [displayValue, setDisplayValue] = useState('0')

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(formatNumber(latest, decimals, separator))
    })
    return unsubscribe
  }, [springValue, decimals, separator])

  return (
    <motion.span 
      className={`tabular-nums ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {prefix}{displayValue}{suffix}
    </motion.span>
  )
}

/**
 * ANIMATED CURRENCY DISPLAY
 * =========================
 * Specialized component for money values.
 * Includes subtle color flash on value change.
 */
export function AnimatedCurrency({
  value,
  className = '',
  showPositiveColor = true,
  currency = '$'
}: {
  value: number
  className?: string
  showPositiveColor?: boolean
  currency?: string
}) {
  const [prevValue, setPrevValue] = useState(value)
  const [isIncreasing, setIsIncreasing] = useState(false)

  useEffect(() => {
    if (value !== prevValue) {
      setIsIncreasing(value > prevValue)
      setPrevValue(value)
    }
  }, [value, prevValue])

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.8, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        color: showPositiveColor && isIncreasing 
          ? ['inherit', '#10B981', 'inherit'] 
          : 'inherit'
      }}
      transition={{ 
        duration: 0.3,
        color: { duration: 0.6 }
      }}
      className={`tabular-nums ${className}`}
    >
      <CountUp 
        value={value} 
        prefix={currency} 
        decimals={2}
        duration={1500}
      />
    </motion.span>
  )
}

export default CountUp

