'use client'

/**
 * AI Agent Creation Wizard
 * ========================
 * 
 * Brand colors, spring motion, 60fps.
 * 
 * A 5-step wizard to create AI agents with:
 * 1. Identity (Name, Description, Avatar)
 * 2. Brain (Provider, Model Selection)
 * 3. Guardrails (Budget, Rate Limits)
 * 4. Security (DLP, Tool Access, Kill Switch)
 * 5. Launch (Review & Create)
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bot, Brain, Shield, Wallet, Rocket, ChevronRight, ChevronLeft, 
  Check, Sparkles, AlertTriangle, Lock, Zap, Eye, EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

// ============================================================================
// TYPES
// ============================================================================

interface AgentConfig {
  // Step 1: Identity
  name: string
  description: string
  avatar_emoji: string
  
  // Step 2: Brain
  provider: 'openai' | 'anthropic' | 'google' | 'local'
  model: string
  temperature: number
  max_tokens: number
  
  // Step 3: Guardrails
  budget_limit: number
  budget_period: 'daily' | 'weekly' | 'monthly'
  rate_limit_per_minute: number
  max_sessions: number
  
  // Step 4: Security
  dlp_enabled: boolean
  tool_approval_required: boolean
  allowed_tools: string[]
  kill_switch_enabled: boolean
  session_timeout_minutes: number
}

interface WizardStep {
  id: number
  title: string
  description: string
  icon: React.ReactNode
  completed: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVATAR_EMOJIS = ['🤖', '🧠', '⚡', '🎯', '🔮', '🦾', '🌟', '🚀', '🎨', '🔥', '💎', '🛡️']

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-4 Turbo', color: '#00A67E' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5 Sonnet, Opus', color: '#D97706' },
  { id: 'google', name: 'Google', description: 'Gemini 1.5 Pro/Flash', color: '#4285F4' },
  { id: 'local', name: 'Local/Self-Hosted', description: 'Ollama, vLLM, LM Studio', color: '#8B5CF6' },
]

const MODELS: Record<string, {id: string, name: string, cost: string}[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Recommended)', cost: '$5/$15 per 1M tokens' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', cost: '$10/$30 per 1M tokens' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', cost: '$0.50/$1.50 per 1M tokens' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommended)', cost: '$3/$15 per 1M tokens' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', cost: '$15/$75 per 1M tokens' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', cost: '$0.25/$1.25 per 1M tokens' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', cost: '$1.25/$5 per 1M tokens' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Recommended)', cost: '$0.075/$0.30 per 1M tokens' },
  ],
  local: [
    { id: 'llama3.2', name: 'Llama 3.2 (Ollama)', cost: 'Free (self-hosted)' },
    { id: 'mistral', name: 'Mistral 7B', cost: 'Free (self-hosted)' },
    { id: 'codellama', name: 'Code Llama', cost: 'Free (self-hosted)' },
  ],
}

const DEFAULT_CONFIG: AgentConfig = {
  name: '',
  description: '',
  avatar_emoji: '🤖',
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 4096,
  budget_limit: 50,
  budget_period: 'monthly',
  rate_limit_per_minute: 60,
  max_sessions: 10,
  dlp_enabled: true,
  tool_approval_required: false,
  allowed_tools: [],
  kill_switch_enabled: true,
  session_timeout_minutes: 30,
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function StepIdentity({ 
  config, 
  onChange 
}: { 
  config: AgentConfig
  onChange: (updates: Partial<AgentConfig>) => void 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-linear-to-r from-[#0066FF] to-[#00AAFF] bg-clip-text text-transparent">
          Give Your Agent an Identity
        </h2>
        <p className="text-slate-500 mt-2">
          Every great AI needs a name and purpose
        </p>
      </div>
      
      {/* Avatar Selection */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-6xl p-4 bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20">
          {config.avatar_emoji}
        </div>
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {AVATAR_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => onChange({ avatar_emoji: emoji })}
              className={`text-2xl p-2 rounded-lg transition-all hover:scale-110 ${
                config.avatar_emoji === emoji 
                  ? 'bg-[#0066FF]/20 ring-2 ring-[#0066FF]' 
                  : 'hover:bg-slate-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      
      {/* Name Input */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-semibold">Agent Name</Label>
        <Input
          id="name"
          value={config.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Support Bot, Code Assistant, Research Agent"
          className="text-lg py-6"
          maxLength={50}
        />
        <p className="text-xs text-slate-500">{config.name.length}/50 characters</p>
      </div>
      
      {/* Description Input */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold">What will this agent do?</Label>
        <Textarea
          id="description"
          value={config.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe the agent's purpose, tasks, and any specific behaviors..."
          className="min-h-[100px] resize-none"
          maxLength={500}
        />
        <p className="text-xs text-slate-500">{config.description.length}/500 characters</p>
      </div>
    </motion.div>
  )
}

function StepBrain({ 
  config, 
  onChange 
}: { 
  config: AgentConfig
  onChange: (updates: Partial<AgentConfig>) => void 
}) {
  const [showApiKey, setShowApiKey] = useState(false)
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-linear-to-r from-[#0066FF] to-[#00AAFF] bg-clip-text text-transparent">
          Choose Your Agent&apos;s Brain
        </h2>
        <p className="text-slate-500 mt-2">
          Select the AI provider and model for your agent
        </p>
      </div>
      
      {/* Provider Selection */}
      <div className="grid grid-cols-2 gap-4">
        {PROVIDERS.map(provider => (
          <button
            key={provider.id}
            onClick={() => onChange({ 
              provider: provider.id as AgentConfig['provider'],
              model: MODELS[provider.id][0].id 
            })}
            className={`p-4 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${
              config.provider === provider.id
                ? 'border-[#0066FF] bg-[#0066FF]/5 shadow-lg shadow-[#0066FF]/10'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: provider.color }}
              />
              <span className="font-semibold">{provider.name}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{provider.description}</p>
            {config.provider === provider.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2"
              >
                <Check className="w-5 h-5 text-[#0066FF]" />
              </motion.div>
            )}
          </button>
        ))}
      </div>
      
      {/* Model Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Select Model</Label>
        <div className="space-y-2">
          {MODELS[config.provider].map(model => (
            <button
              key={model.id}
              onClick={() => onChange({ model: model.id })}
              className={`w-full p-3 rounded-lg border transition-all text-left ${
                config.model === model.id
                  ? 'border-[#0066FF] bg-[#0066FF]/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{model.name}</span>
                <Badge variant="secondary" className="text-xs">{model.cost}</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Advanced Settings */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-sm">Advanced Settings</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm">Temperature: {config.temperature}</Label>
            <span className="text-xs text-slate-500">
              {config.temperature < 0.3 ? 'Focused' : config.temperature > 0.7 ? 'Creative' : 'Balanced'}
            </span>
          </div>
          <Slider
            value={[config.temperature]}
            onValueChange={([v]) => onChange({ temperature: v })}
            min={0}
            max={1}
            step={0.1}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm">Max Output Tokens</Label>
          <Input
            type="number"
            value={config.max_tokens}
            onChange={(e) => onChange({ max_tokens: parseInt(e.target.value) || 4096 })}
            min={100}
            max={128000}
          />
        </div>
      </div>
    </motion.div>
  )
}

function StepGuardrails({ 
  config, 
  onChange 
}: { 
  config: AgentConfig
  onChange: (updates: Partial<AgentConfig>) => void 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-linear-to-r from-[#0066FF] to-[#00AAFF] bg-clip-text text-transparent">
          Set Guardrails & Limits
        </h2>
        <p className="text-slate-500 mt-2">
          Prevent runaway costs and keep your agent in control
        </p>
      </div>
      
      {/* Budget Card */}
      <Card className="border-2 border-amber-500/20 bg-linear-to-br from-amber-50 to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <Wallet className="w-5 h-5" />
            Budget Protection
          </CardTitle>
          <CardDescription>
            Your agent will pause when it reaches the budget limit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm">Budget Limit</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  type="number"
                  value={config.budget_limit}
                  onChange={(e) => onChange({ budget_limit: parseFloat(e.target.value) || 0 })}
                  className="pl-8 text-xl font-bold"
                  min={1}
                  max={10000}
                />
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-sm">Period</Label>
              <select
                value={config.budget_period}
                onChange={(e) => onChange({ budget_period: e.target.value as AgentConfig['budget_period'] })}
                className="w-full h-10 rounded-md border border-slate-200 px-3"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          
          {/* Budget Visualization */}
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-slate-600 mb-2">
              Estimated usage at current rate:
            </div>
            <div className="flex items-end gap-1 h-16">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${Math.min(100, (Math.random() * 60 + 20))}%`,
                    backgroundColor: i < 25 ? '#22C55E' : '#EF4444'
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Day 1</span>
              <span>Day 30</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Rate Limits */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Rate Limit (per minute)</Label>
          <Input
            type="number"
            value={config.rate_limit_per_minute}
            onChange={(e) => onChange({ rate_limit_per_minute: parseInt(e.target.value) || 60 })}
            min={1}
            max={1000}
          />
          <p className="text-xs text-slate-500">Requests per minute</p>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Max Concurrent Sessions</Label>
          <Input
            type="number"
            value={config.max_sessions}
            onChange={(e) => onChange({ max_sessions: parseInt(e.target.value) || 10 })}
            min={1}
            max={100}
          />
          <p className="text-xs text-slate-500">Parallel sessions allowed</p>
        </div>
      </div>
    </motion.div>
  )
}

function StepSecurity({ 
  config, 
  onChange 
}: { 
  config: AgentConfig
  onChange: (updates: Partial<AgentConfig>) => void 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-linear-to-r from-[#0066FF] to-[#00AAFF] bg-clip-text text-transparent">
          Configure Security
        </h2>
        <p className="text-slate-500 mt-2">
          Keep your data safe and maintain control
        </p>
      </div>
      
      {/* Kill Switch (Always On) */}
      <Card className="border-2 border-red-500/20 bg-linear-to-br from-red-50 to-pink-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-red-700">Emergency Kill Switch</h3>
                <p className="text-sm text-red-600/70">
                  Instantly stop all agent activity in &lt;5ms
                </p>
              </div>
            </div>
            <Switch
              checked={config.kill_switch_enabled}
              onCheckedChange={(checked) => onChange({ kill_switch_enabled: checked })}
              className="data-[state=checked]:bg-red-500"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* DLP Protection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0066FF] rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">DLP Protection</h3>
                <p className="text-sm text-slate-500">
                  Scan all inputs/outputs for sensitive data (API keys, PII)
                </p>
              </div>
            </div>
            <Switch
              checked={config.dlp_enabled}
              onCheckedChange={(checked) => onChange({ dlp_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Tool Approval */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Tool Approval Required</h3>
                <p className="text-sm text-slate-500">
                  Require human approval before agent uses external tools
                </p>
              </div>
            </div>
            <Switch
              checked={config.tool_approval_required}
              onCheckedChange={(checked) => onChange({ tool_approval_required: checked })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Session Timeout */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Session Timeout</Label>
        <div className="flex items-center gap-4">
          <Slider
            value={[config.session_timeout_minutes]}
            onValueChange={([v]) => onChange({ session_timeout_minutes: v })}
            min={5}
            max={120}
            step={5}
            className="flex-1"
          />
          <span className="font-mono text-sm w-20">
            {config.session_timeout_minutes} min
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Sessions automatically end after this period of inactivity
        </p>
      </div>
    </motion.div>
  )
}

function StepLaunch({ 
  config,
  isCreating,
  onCreate
}: { 
  config: AgentConfig
  isCreating: boolean
  onCreate: () => void
}) {
  const selectedProvider = PROVIDERS.find(p => p.id === config.provider)
  const selectedModel = MODELS[config.provider].find(m => m.id === config.model)
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-linear-to-r from-[#0066FF] to-[#00AAFF] bg-clip-text text-transparent">
          Ready to Launch!
        </h2>
        <p className="text-slate-500 mt-2">
          Review your agent configuration
        </p>
      </div>
      
      {/* Agent Preview Card */}
      <Card className="border-2 border-[#0066FF]/20 bg-linear-to-br from-blue-50 to-indigo-50 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-bl from-[#0066FF]/20 to-transparent rounded-bl-full" />
        
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl p-3 bg-white rounded-xl shadow-sm">
              {config.avatar_emoji}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{config.name || 'Unnamed Agent'}</h3>
              <p className="text-sm text-slate-600 mt-1">{config.description || 'No description'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            {/* Provider & Model */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Brain</p>
              <p className="font-semibold flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: selectedProvider?.color }}
                />
                {selectedProvider?.name}
              </p>
              <p className="text-sm text-slate-600">{selectedModel?.name}</p>
            </div>
            
            {/* Budget */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Budget</p>
              <p className="font-semibold text-green-600">${config.budget_limit}</p>
              <p className="text-sm text-slate-600">per {config.budget_period}</p>
            </div>
            
            {/* Rate Limit */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Rate Limit</p>
              <p className="font-semibold">{config.rate_limit_per_minute}/min</p>
              <p className="text-sm text-slate-600">{config.max_sessions} concurrent</p>
            </div>
            
            {/* Security */}
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Security</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {config.dlp_enabled && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">DLP</Badge>
                )}
                {config.kill_switch_enabled && (
                  <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Kill Switch</Badge>
                )}
                {config.tool_approval_required && (
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Approvals</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Launch Button */}
      <Button
        onClick={onCreate}
        disabled={isCreating || !config.name}
        className="w-full py-6 text-lg bg-linear-to-r from-[#0066FF] to-[#00AAFF] hover:from-[#0055DD] hover:to-[#0099DD] shadow-lg shadow-[#0066FF]/30"
      >
        {isCreating ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="mr-2"
            >
              <Sparkles className="w-5 h-5" />
            </motion.div>
            Creating Agent...
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5 mr-2" />
            Launch Agent
          </>
        )}
      </Button>
      
      <p className="text-center text-xs text-slate-500">
        You can modify these settings anytime from the Agent Dashboard
      </p>
    </motion.div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface AgentCreationWizardProps {
  onComplete: (agentId: string) => void
  onCancel: () => void
}

export function AgentCreationWizard({ onComplete, onCancel }: AgentCreationWizardProps) {
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [isCreating, setIsCreating] = useState(false)
  
  const steps: WizardStep[] = [
    { id: 0, title: 'Identity', description: 'Name & purpose', icon: <Bot className="w-4 h-4" />, completed: !!config.name },
    { id: 1, title: 'Brain', description: 'Provider & model', icon: <Brain className="w-4 h-4" />, completed: !!config.model },
    { id: 2, title: 'Guardrails', description: 'Budget & limits', icon: <Wallet className="w-4 h-4" />, completed: config.budget_limit > 0 },
    { id: 3, title: 'Security', description: 'DLP & tools', icon: <Shield className="w-4 h-4" />, completed: true },
    { id: 4, title: 'Launch', description: 'Review & create', icon: <Rocket className="w-4 h-4" />, completed: false },
  ]
  
  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])
  
  const canProgress = () => {
    switch (step) {
      case 0: return config.name.length >= 3
      case 1: return !!config.model
      case 2: return config.budget_limit > 0
      case 3: return true
      case 4: return true
      default: return false
    }
  }
  
  const handleCreate = async () => {
    setIsCreating(true)
    
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        toast.error('Please sign in to create an agent')
        return
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        toast.error('API URL not configured')
        return
      }
      
      const response = await fetch(`${apiUrl}/v1/agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          metadata: {
            avatar_emoji: config.avatar_emoji,
            temperature: config.temperature,
            max_tokens: config.max_tokens
          },
          budget_limit: config.budget_limit,
          provider: config.provider,
          model: config.model,
          dlp_enabled: config.dlp_enabled,
          tool_approval_required: config.tool_approval_required,
          session_timeout_minutes: config.session_timeout_minutes
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create agent')
      }
      
      const data = await response.json()
      
      // 🎉 Success celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0066FF', '#00AAFF', '#22C55E']
      })
      
      toast.success('🚀 Agent created successfully!', {
        description: `${config.name} is ready to go`
      })
      
      onComplete(data.agent.id)
      
    } catch (error) {
      toast.error('Failed to create agent', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsCreating(false)
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                i === step
                  ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/30'
                  : i < step
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : s.icon}
              <span className="hidden sm:inline text-sm font-medium">{s.title}</span>
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className={`w-4 h-4 mx-1 ${i < step ? 'text-green-500' : 'text-slate-300'}`} />
            )}
          </div>
        ))}
      </div>
      
      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 0 && <StepIdentity config={config} onChange={updateConfig} />}
        {step === 1 && <StepBrain config={config} onChange={updateConfig} />}
        {step === 2 && <StepGuardrails config={config} onChange={updateConfig} />}
        {step === 3 && <StepSecurity config={config} onChange={updateConfig} />}
        {step === 4 && <StepLaunch config={config} isCreating={isCreating} onCreate={handleCreate} />}
      </AnimatePresence>
      
      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => step > 0 ? setStep(step - 1) : onCancel()}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        
        {step < 4 && (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProgress()}
            className="bg-[#0066FF] hover:bg-[#0055DD]"
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default AgentCreationWizard

