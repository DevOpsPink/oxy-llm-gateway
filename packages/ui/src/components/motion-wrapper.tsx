"use client"

/**
 * MOTION WRAPPER COMPONENTS
 * =========================
 * 
 * Framer Motion animation utilities
 * 
 * Usage:
 * - FadeIn: Smooth fade-in animation
 * - SlideIn: Slide from direction with fade
 * - ScaleIn: Scale up with fade
 * - StaggerContainer: Stagger children animations
 * - StaggerItem: Child of StaggerContainer
 */

import { motion, Variants } from 'framer-motion'
import { ReactNode } from 'react'

// Fade In Animation
export const FadeIn = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
)

// Slide In Animation
type SlideDirection = 'up' | 'down' | 'left' | 'right'

export const SlideIn = ({ 
  children, 
  direction = 'up', 
  delay = 0 
}: { 
  children: ReactNode
  direction?: SlideDirection
  delay?: number 
}) => {
  const directions = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 }
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

// Scale In Animation (for cards, modals)
export const ScaleIn = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
)

// Stagger Container (for lists)
export const StaggerContainer = ({ children }: { children: ReactNode }) => {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}

// Stagger Item (child of StaggerContainer)
export const StaggerItem = ({ children }: { children: ReactNode }) => {
  const item: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  }

  return (
    <motion.div variants={item}>
      {children}
    </motion.div>
  )
}

// Hover Scale (for interactive cards)
export const HoverScale = ({ children, scale = 1.02 }: { children: ReactNode; scale?: number }) => (
  <motion.div
    whileHover={{ scale }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
)

// Pulse (for attention-grabbing elements)
export const Pulse = ({ children }: { children: ReactNode }) => (
  <motion.div
    animate={{
      scale: [1, 1.02, 1],
    }}
    transition={{
      duration: 2,
      ease: "easeInOut",
      repeat: Infinity,
    }}
  >
    {children}
  </motion.div>
)

