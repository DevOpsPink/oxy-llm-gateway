"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingUp, Shield, Zap } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import confetti from 'canvas-confetti'

interface BudgetPrediction {
  recommended: number
  range: { min: number; max: number }
  reasoning: string
  confidence: number // 0-100
  comparisons: Array<{
    label: string
    value: number
    description: string
  }>
}

interface BudgetOracleProps {
  userEmail: string
  industry?: string
  onBudgetSelect: (budget: number) => void
}

export function BudgetOracle({ userEmail, industry, onBudgetSelect }: BudgetOracleProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [prediction, setPrediction] = useState<BudgetPrediction | null>(null)
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null)
  const [customBudget, setCustomBudget] = useState<string>('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  useEffect(() => {
    async function fetchPrediction() {
      setIsAnalyzing(true)
      
      // Short pause before showing the estimate (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      try {
        const res = await fetch('/api/intelligence/budget-prediction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: userEmail,
            industry 
          })
        })
        
        if (!res.ok) {
          throw new Error('Prediction failed')
        }
        
        const data: BudgetPrediction = await res.json()
        setPrediction(data)
        
        // 🎉 DELIGHT MOMENT: Confetti when Oracle reveals prediction
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0066FF', '#FF6B35', '#10B981'],
          ticks: 200,
          gravity: 1.2,
          decay: 0.94,
          startVelocity: 30
        })
        
      } catch (error) {
        console.error('Budget prediction error:', error)
        
        // Graceful fallback: Show generic but useful prediction
        setPrediction({
          recommended: 150,
          range: { min: 50, max: 500 },
          reasoning: "Based on typical AI usage patterns for developers",
          confidence: 75,
          comparisons: [
            { label: "Conservative", value: 50, description: "Hobby projects, low traffic" },
            { label: "Recommended", value: 150, description: "Small production apps" },
            { label: "Growth", value: 500, description: "High-traffic applications" }
          ]
        })
      } finally {
        setIsAnalyzing(false)
      }
    }
    
    fetchPrediction()
  }, [userEmail, industry])

  const handleBudgetSelect = (budget: number) => {
    setSelectedBudget(budget)
    onBudgetSelect(budget)
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-4 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-8 bg-linear-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200"
        >
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="mb-4"
          >
            <Sparkles className="h-12 w-12 text-blue-600" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-medium text-blue-900"
          >
            🔮 Analyzing your AI usage patterns...
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-blue-700 mt-2"
          >
            Consulting the Oracle...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  if (!prediction) return null

  return (
    <div className="space-y-6">
      {/* Oracle Prediction Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-linear-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border-2 border-blue-300 rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-linear-to-br from-blue-600 to-purple-600 rounded-xl shadow-md">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              🔮 The Oracle Has Spoken
            </h3>
            <p className="text-sm text-slate-600">
              Based on your profile{industry && ` (${industry})`}, here's your intelligent budget forecast:
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
            {prediction.confidence}% confident
          </div>
        </div>

        {/* Recommended Budget (Big & Bold) */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 mb-4 border border-blue-200">
          <p className="text-sm font-medium text-slate-600 mb-2">💎 Recommended Monthly Budget:</p>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600 mb-3"
          >
            ${prediction.recommended}
          </motion.div>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Why?</strong> {prediction.reasoning}
          </p>
        </div>

        {/* Budget Options (Cards) */}
        <div className="space-y-3 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Choose a starting budget:</p>
          <div className="grid grid-cols-3 gap-3">
            {prediction.comparisons.map((option) => (
              <motion.button
                key={option.label}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleBudgetSelect(option.value)}
                className={`
                  relative p-4 rounded-lg border-2 transition-all
                  ${selectedBudget === option.value 
                    ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                  }
                `}
              >
                {/* Checkmark for selected */}
                {selectedBudget === option.value && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-blue-600 rounded-full p-1"
                  >
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                )}
                
                {/* Icon based on tier */}
                <div className="mb-2">
                  {option.label === 'Conservative' && <Shield className="h-5 w-5 text-slate-600 mx-auto" />}
                  {option.label === 'Recommended' && <Sparkles className="h-5 w-5 text-blue-600 mx-auto" />}
                  {option.label === 'Growth' && <TrendingUp className="h-5 w-5 text-purple-600 mx-auto" />}
                </div>
                
                <p className="text-xs font-semibold text-slate-700 mb-1">{option.label}</p>
                <p className="text-2xl font-bold text-slate-900 mb-1">${option.value}</p>
                <p className="text-xs text-slate-500 leading-tight">{option.description}</p>
                
                {/* Recommended badge */}
                {option.label === 'Recommended' && (
                  <div className="mt-2 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    ✨ Oracle's Pick
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Custom Budget Option */}
        <button
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
        >
          {showCustomInput ? '← Back to recommendations' : 'Set custom budget →'}
        </button>

        <AnimatePresence>
          {showCustomInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-2"
            >
              <Label htmlFor="custom-budget" className="text-sm font-medium text-slate-700">
                Custom Monthly Budget
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-slate-500 pointer-events-none">$</span>
                  <Input
                    id="custom-budget"
                    type="number"
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && customBudget) {
                        handleBudgetSelect(parseFloat(customBudget))
                      }
                    }}
                    className="pl-7"
                    placeholder="Enter amount"
                    min="0"
                    step="1"
                  />
                </div>
                <Button
                  onClick={() => customBudget && handleBudgetSelect(parseFloat(customBudget))}
                  disabled={!customBudget || parseFloat(customBudget) <= 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Set Budget
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                💡 Tip: Start conservative. You can always increase it later.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Educational Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-slate-50 border border-slate-200 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">💡 How budget protection works:</p>
            <ul className="space-y-0.5 ml-4 list-disc">
              <li>Requests are atomic (no race conditions)</li>
              <li>You'll receive alerts at 75%, 90%, and 100% usage</li>
              <li>API requests stop automatically when limit is reached</li>
              <li>Budget resets monthly (or adjust anytime in settings)</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

