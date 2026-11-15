"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Trophy, Sparkles, DollarSign, X } from 'lucide-react'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import confetti from 'canvas-confetti'

interface Achievement {
  type: 'first_request' | 'first_saved_dollar' | 'cost_warrior'
  data: {
    cost_saved: number
    model: string
    timestamp: string
  }
}

interface CelebrationModalProps {
  achievement: Achievement
  onClose: () => void
}

export function CelebrationModal({ achievement, onClose }: CelebrationModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'enter' | 'celebrate' | 'exit'>('enter')

  useEffect(() => {
    // PHASE 1: ENTER (appear with scale animation)
    setIsVisible(true)
    
    // Immediate confetti burst
    const fireConfetti = () => {
      const count = 200
      const defaults = {
        origin: { y: 0.7 },
        zIndex: 99999
      }

      function fire(particleRatio: number, opts: any) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
          spread: 90,
          startVelocity: 45,
          decay: 0.9,
          scalar: 1.2,
        })
      }

      // Brand color confetti (Trust Blue + Signal Orange)
      fire(0.25, {
        spread: 26,
        startVelocity: 55,
        colors: ['#0066FF', '#0052CC', '#003D99'] // Trust Blue shades
      })
      fire(0.2, {
        spread: 60,
        colors: ['#FF6B35', '#FF8C5F', '#FFB399'] // Signal Orange shades
      })
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
        colors: ['#10B981', '#34D399'] // Green (success)
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
        colors: ['#F59E0B', '#FBBF24'] // Gold (achievement)
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
        colors: ['#FFFFFF'] // White sparkles
      })
    }

    // First explosion
    setTimeout(() => {
      fireConfetti()
      setAnimationPhase('celebrate')
    }, 200)

    // Second explosion (delayed)
    setTimeout(() => {
      fireConfetti()
    }, 800)

    // Third explosion (final)
    setTimeout(() => {
      fireConfetti()
    }, 1400)

    // Auto-close after 5 seconds
    const autoCloseTimer = setTimeout(() => {
      setAnimationPhase('exit')
      setTimeout(() => {
        onClose()
      }, 500)
    }, 5000)

    return () => clearTimeout(autoCloseTimer)
  }, [onClose])

  const getAchievementContent = () => {
    switch (achievement.type) {
      case 'first_request':
        return {
          icon: Trophy,
          iconColor: 'text-yellow-400',
          iconBg: 'from-yellow-400 to-orange-500',
          title: '🎉 FIRST REQUEST COMPLETE!',
          subtitle: 'Achievement Unlocked',
          mainText: `You just saved $${achievement.data.cost_saved.toFixed(4)}`,
          description: `Your first ${achievement.data.model} request went through Oxy Engine. Budget protected, threats blocked, costs tracked.`,
          badge: 'FIRST BLOOD',
          badgeColor: 'bg-linear-to-r from-purple-600 to-blue-600'
        }
      default:
        return {
          icon: Sparkles,
          iconColor: 'text-blue-400',
          iconBg: 'from-blue-400 to-purple-500',
          title: '✨ ACHIEVEMENT UNLOCKED!',
          subtitle: 'New Milestone',
          mainText: 'Congratulations!',
          description: "You've reached a new milestone.",
          badge: 'ACHIEVEMENT',
          badgeColor: 'bg-linear-to-r from-blue-600 to-purple-600'
        }
    }
  }

  const content = getAchievementContent()
  const Icon = content.icon

  return (
    <Dialog open={isVisible} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md p-0 bg-slate-900 border-4 border-yellow-500/50 overflow-hidden shadow-2xl"
        showCloseButton={false}
      >
        <AnimatePresence mode="wait">
          {animationPhase !== 'exit' && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateY: -90 }}
              animate={{ 
                scale: animationPhase === 'celebrate' ? [1, 1.05, 1] : 1,
                opacity: 1, 
                rotateY: 0
              }}
              exit={{ scale: 0.8, opacity: 0, rotateY: 90 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 20,
                scale: {
                  repeat: animationPhase === 'celebrate' ? Infinity : 0,
                  repeatDelay: 0.5,
                  duration: 0.6
                }
              }}
              className="relative"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setAnimationPhase('exit')
                  setTimeout(onClose, 500)
                }}
                className="absolute top-4 right-4 z-50 p-1 rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors"
                aria-label="Close celebration"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>

              {/* Animated Background Glow */}
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-linear-to-br from-yellow-500/20 via-orange-500/20 to-purple-500/20 blur-3xl"
              />

              {/* Content */}
              <div className="relative z-10 p-8">
                {/* Badge (top) */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center mb-4"
                >
                  <div className={`${content.badgeColor} px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider shadow-lg`}>
                    {content.badge}
                  </div>
                </motion.div>

                {/* Icon */}
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 5, -5, 0],
                    scale: [1, 1.1, 1.05, 1.1, 1]
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="flex justify-center mb-6"
                >
                  <div className={`relative p-6 rounded-full bg-linear-to-br ${content.iconBg} shadow-2xl`}>
                    {/* Pulsing ring */}
                    <motion.div
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut"
                      }}
                      className={`absolute inset-0 rounded-full bg-linear-to-br ${content.iconBg}`}
                    />
                    <Icon className={`h-16 w-16 ${content.iconColor} relative z-10`} />
                  </div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-black text-center text-transparent bg-clip-text bg-linear-to-r from-yellow-400 via-orange-400 to-yellow-400 mb-2"
                  style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.5)' }}
                >
                  {content.title}
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-center text-slate-500 text-sm font-medium mb-6 uppercase tracking-wider"
                >
                  {content.subtitle}
                </motion.p>

                {/* Main Stat */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  className="bg-linear-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 rounded-xl p-6 mb-6"
                >
                  <div className="flex items-center justify-center gap-3">
                    <DollarSign className="h-8 w-8 text-green-400" />
                    <div>
                      <p className="text-sm text-green-300 font-medium">COST SAVINGS</p>
                      <p className="text-4xl font-black text-green-400">
                        {content.mainText}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-center text-slate-300 text-sm leading-relaxed mb-6"
                >
                  {content.description}
                </motion.p>

                {/* Stats Row */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <Zap className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Protected</p>
                    <p className="text-lg font-bold text-white">100%</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <Trophy className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Level</p>
                    <p className="text-lg font-bold text-white">1</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                    <Sparkles className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Rank</p>
                    <p className="text-lg font-bold text-white">Novice</p>
                  </div>
                </motion.div>

                {/* Social Proof */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-6 text-center"
                >
                  <p className="text-xs text-slate-500">
                    🎮 Join <strong className="text-slate-300">1,247 developers</strong> who've completed their first request
                  </p>
                </motion.div>
              </div>

              {/* Border Glow Animation */}
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 border-4 border-yellow-500/50 rounded-lg pointer-events-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
