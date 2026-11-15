"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, Lock, Shield, Zap, Sparkles, Check, Copy, Terminal, ArrowRight } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import confetti from 'canvas-confetti'
import { toast } from 'sonner'

interface FirstRequestCeremonyProps {
  apiKey: string
  onClose: () => void
}

export function FirstRequestCeremony({ apiKey, onClose }: FirstRequestCeremonyProps) {
  const [phase, setPhase] = useState<'ignition' | 'revealed' | 'demo'>('ignition')
  const [ignitionStep, setIgnitionStep] = useState(0)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [copied, setCopied] = useState(false)

  const ignitionSteps = [
    { icon: Zap, text: 'Encrypting with AES-256...', delay: 500 },
    { icon: Lock, text: 'Generating cryptographic signature...', delay: 700 },
    { icon: Shield, text: 'Configuring security policies...', delay: 600 },
    { icon: Sparkles, text: 'Registering with provider network...', delay: 800 },
    { icon: Check, text: 'Your AI Control Plane is LIVE!', delay: 500 }
  ]

  // PHASE 1: Ignition Sequence
  useEffect(() => {
    if (phase !== 'ignition') return

    const timer = setTimeout(() => {
      if (ignitionStep < ignitionSteps.length - 1) {
        setIgnitionStep(ignitionStep + 1)
      } else {
        // Transition to reveal phase
        setTimeout(() => {
          setPhase('revealed')
          // Confetti when key is revealed
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#0066FF', '#FF6B35', '#10B981', '#F59E0B']
          })
        }, 600)
      }
    }, ignitionSteps[ignitionStep].delay)

    return () => clearTimeout(timer)
  }, [ignitionStep, phase])

  // PHASE 3: Demo Request Execution
  const executeDemoRequest = async () => {
    setPhase('demo')
    setIsExecuting(true)
    setTerminalOutput([])

    const steps = [
      { text: '$ curl http://localhost:8000/v1/chat/completions \\', delay: 50 },
      { text: '    -H "Authorization: Bearer oxy_live_..." \\', delay: 50 },
      { text: '    -d \'{"model": "gpt-4", "messages": [...]}\'', delay: 100 },
      { text: '', delay: 300 },
      { text: '> Connecting to OpenAI...', delay: 400 },
      { text: '> Request authorized ✓', delay: 300 },
      { text: '> Budget verified ($0.002 reserved) ✓', delay: 300 },
      { text: '> Sending to gpt-4...', delay: 800 },
      { text: '', delay: 400 },
      { text: '{', delay: 100 },
      { text: '  "id": "chatcmpl-8xK9j2P4mL...",', delay: 80 },
      { text: '  "choices": [{', delay: 80 },
      { text: '    "message": {', delay: 80 },
      { text: '      "role": "assistant",', delay: 80 },
      { text: '      "content": "Hello! I\'m running through Oxy Engine."', delay: 80 },
      { text: '    }', delay: 80 },
      { text: '  }]', delay: 80 },
      { text: '}', delay: 100 },
      { text: '', delay: 300 },
      { text: '✨ SUCCESS! Cost: $0.002 | Latency: 847ms | Threats: 0', delay: 500, isSuccess: true }
    ]

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay))
      setTerminalOutput(prev => [...prev, step.text])
      
      // Success confetti
      if (step.isSuccess) {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.7 },
          colors: ['#10B981', '#0066FF', '#F59E0B']
        })
      }
    }

    setIsExecuting(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    toast.success('API key copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={true} onOpenChange={() => !isExecuting && onClose()}>
      <DialogContent className="max-w-3xl p-0 bg-slate-900 border-blue-500/30 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* PHASE 1: IGNITION SEQUENCE */}
          {phase === 'ignition' && (
            <motion.div
              key="ignition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-12 text-center"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                }}
                className="mb-8"
              >
                <Rocket className="h-24 w-24 text-blue-500 mx-auto" />
              </motion.div>

              <h2 className="text-3xl font-bold text-white mb-8">
                🚀 IGNITION SEQUENCE
              </h2>

              <div className="space-y-4 max-w-md mx-auto">
                {ignitionSteps.map((step, idx) => {
                  const Icon = step.icon
                  const isComplete = idx < ignitionStep
                  const isActive = idx === ignitionStep

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ 
                        opacity: isComplete || isActive ? 1 : 0.3,
                        x: 0
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        isActive ? 'bg-blue-500/20 border border-blue-500/50' : ''
                      }`}
                    >
                      {isComplete ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <Icon className={`h-5 w-5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                      )}
                      <span className={`text-sm font-medium ${
                        isActive ? 'text-white' : isComplete ? 'text-slate-500' : 'text-slate-600'
                      }`}>
                        {step.text}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* PHASE 2: KEY REVEALED */}
          {phase === 'revealed' && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-12"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <Sparkles className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  ✨ Your Gateway is LIVE!
                </h2>
                <p className="text-slate-500">
                  This is your personal AI proxy. Guard it carefully.
                </p>
              </div>

              {/* API Key Display */}
              <div className="bg-slate-800 rounded-xl p-6 mb-6 border-2 border-blue-500/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Your API Key
                  </span>
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        '0 0 10px rgba(59, 130, 246, 0.5)',
                        '0 0 20px rgba(59, 130, 246, 0.8)',
                        '0 0 10px rgba(59, 130, 246, 0.5)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-green-500 rounded-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-lg font-mono text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-400 truncate">
                    {apiKey}
                  </code>
                  <Button
                    onClick={copyToClipboard}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-200 flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Security:</strong> This key will never be shown again. Store it in a secure location (e.g., environment variables, password manager).
                  </span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={executeDemoRequest}
                  size="lg"
                  className="flex-1 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  <Terminal className="h-5 w-5 mr-2" />
                  Make First Request
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  onClick={onClose}
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          )}

          {/* PHASE 3: DEMO REQUEST */}
          {phase === 'demo' && (
            <motion.div
              key="demo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-green-500" />
                  Live Demo Request
                </h3>
                {!isExecuting && (
                  <Button
                    onClick={onClose}
                    size="sm"
                    variant="ghost"
                    className="text-slate-500 hover:text-white"
                  >
                    Close
                  </Button>
                )}
              </div>

              {/* Terminal Output */}
              <div className="bg-black rounded-lg p-6 font-mono text-sm min-h-[400px] max-h-[500px] overflow-y-auto">
                {terminalOutput.map((line, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    className={`mb-1 ${
                      line.startsWith('$') ? 'text-blue-400' :
                      line.startsWith('>') ? 'text-yellow-400' :
                      line.startsWith('✨') ? 'text-green-400 font-bold' :
                      line.startsWith('{') || line.startsWith('}') ? 'text-purple-400' :
                      'text-slate-300'
                    }`}
                  >
                    {line || '\u00A0'}
                  </motion.div>
                ))}
                {isExecuting && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-green-500"
                  >
                    ▋
                  </motion.span>
                )}
              </div>

              {!isExecuting && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex gap-3"
                >
                  <Button
                    onClick={onClose}
                    size="lg"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                  >
                    View in Dashboard
                  </Button>
                  <Button
                    onClick={onClose}
                    size="lg"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Integrate in My App
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

