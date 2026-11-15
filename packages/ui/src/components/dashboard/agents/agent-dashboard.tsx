'use client'

/**
 * Agent Dashboard Component
 * =========================
 * 
 * Real-time monitoring and management of AI agents.
 * 
 * Features:
 * - Live agent status
 * - Session monitoring
 * - Tool call history
 * - Kill switch
 * - Budget tracking
 * 
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Play,
  Pause,
  Square,
  Trash2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  DollarSign,
  RefreshCw,
  ChevronRight,
  Terminal,
  Wrench,
  XCircle,
  MoreVertical
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// ============================================================================
// API HELPER
// ============================================================================

async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) return null
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return null
    
    return await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    })
  } catch {
    return null
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface Agent {
  id: string
  name: string
  description?: string
  agent_type: string
  default_model: string
  status: 'active' | 'paused' | 'disabled' | 'archived'
  budget_limit: number
  current_spend: number
  total_requests: number
  total_tool_calls: number
  last_active_at?: string
  created_at: string
}

interface Session {
  id: string
  session_type: string
  name?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout' | 'killed'
  started_at: string
  ended_at?: string
  total_requests: number
  total_tokens: number
  total_cost: number
  total_tool_calls: number
  error_message?: string
}

interface ToolCall {
  id: string
  tool_name: string
  status: string
  duration_ms?: number
  threat_detected: boolean
  started_at: string
}

// ============================================================================
// STATUS COMPONENTS
// ============================================================================

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    active: { color: 'bg-emerald-500', icon: <CheckCircle2 className="h-3 w-3" /> },
    running: { color: 'bg-emerald-500 animate-pulse', icon: <Activity className="h-3 w-3" /> },
    paused: { color: 'bg-amber-500', icon: <Pause className="h-3 w-3" /> },
    disabled: { color: 'bg-slate-400', icon: <XCircle className="h-3 w-3" /> },
    completed: { color: 'bg-blue-500', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { color: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
    killed: { color: 'bg-red-600', icon: <Square className="h-3 w-3" /> },
    timeout: { color: 'bg-orange-500', icon: <Clock className="h-3 w-3" /> },
    pending: { color: 'bg-slate-400', icon: <Clock className="h-3 w-3" /> },
  }
  
  const config = statusConfig[status] || { color: 'bg-slate-400', icon: null }
  
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1`}>
      {config.icon}
      {status}
    </Badge>
  )
}

// ============================================================================
// AGENT CARD
// ============================================================================

const AgentCard = ({
  agent,
  onPause,
  onResume,
  onKillAll,
  onDelete,
  onSelect
}: {
  agent: Agent
  onPause: (id: string) => void
  onResume: (id: string) => void
  onKillAll: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (agent: Agent) => void
}) => {
  const budgetPercent = agent.budget_limit > 0 
    ? (agent.current_spend / agent.budget_limit) * 100 
    : 0
  
  const isOverBudget = budgetPercent > 90
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.01 }}
      className="cursor-pointer"
      onClick={() => onSelect(agent)}
    >
      <Card className={`
        border transition-all duration-200
        ${agent.status === 'active' ? 'border-emerald-200 hover:border-emerald-400' : 'border-slate-200'}
        ${isOverBudget ? 'border-red-300 bg-red-50/50' : ''}
      `}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                ${agent.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}
              `}>
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <CardDescription className="text-xs">
                  {agent.agent_type} • {agent.default_model}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <StatusBadge status={agent.status} />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {agent.status === 'active' ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPause(agent.id); }}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Agent
                    </DropdownMenuItem>
                  ) : agent.status === 'paused' ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResume(agent.id); }}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume Agent
                    </DropdownMenuItem>
                  ) : null}
                  
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onKillAll(agent.id); }}
                    className="text-orange-600"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Kill All Sessions
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Agent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-2">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{agent.total_requests.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Requests</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{agent.total_tool_calls.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Tool Calls</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-600' : 'text-slate-900'}`}>
                ${agent.current_spend.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">Spent</p>
            </div>
          </div>
          
          {/* Budget Bar */}
          {agent.budget_limit > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Budget Usage</span>
                <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-slate-600'}>
                  ${agent.current_spend.toFixed(2)} / ${agent.budget_limit.toFixed(2)}
                </span>
              </div>
              <Progress 
                value={Math.min(budgetPercent, 100)} 
                className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : ''}`}
              />
            </div>
          )}
          
          {/* Last Active */}
          {agent.last_active_at && (
            <p className="text-xs text-slate-500 mt-3">
              Last active: {new Date(agent.last_active_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// SESSION CARD
// ============================================================================

const SessionCard = ({
  session,
  onKill,
  onSelect
}: {
  session: Session
  onKill: (id: string) => void
  onSelect: (session: Session) => void
}) => {
  const isRunning = session.status === 'running' || session.status === 'pending'
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      onClick={() => onSelect(session)}
    >
      <div className="flex items-center gap-3">
        <div className={`
          p-1.5 rounded
          ${isRunning ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'}
        `}>
          {isRunning ? (
            <Activity className="h-4 w-4 animate-pulse" />
          ) : (
            <Terminal className="h-4 w-4" />
          )}
        </div>
        
        <div>
          <p className="font-medium text-sm">{session.name || `Session ${session.id.slice(0, 8)}`}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{session.session_type}</span>
            <span>•</span>
            <span>{session.total_requests} requests</span>
            <span>•</span>
            <span>${session.total_cost.toFixed(4)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <StatusBadge status={session.status} />
        
        {isRunning && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-red-600 hover:bg-red-100"
            onClick={(e) => { e.stopPropagation(); onKill(session.id); }}
          >
            <Square className="h-3 w-3 mr-1" />
            Kill
          </Button>
        )}
        
        <ChevronRight className="h-4 w-4 text-slate-500" />
      </div>
    </motion.div>
  )
}

// ============================================================================
// KILL DIALOG
// ============================================================================

const KillDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Square className="h-4 w-4 mr-2" />
            Confirm Kill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export function AgentDashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [killDialog, setKillDialog] = useState<{
    open: boolean
    type: 'session' | 'all'
    targetId: string
    agentId?: string
  }>({ open: false, type: 'session', targetId: '' })
  
  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await apiRequest('/v1/agents')
      if (res?.ok) {
        const data = await res.json()
        setAgents(data.agents || [])
      }
    } catch {
      // Silent fail - user may not have agents yet
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Fetch sessions for selected agent
  const fetchSessions = useCallback(async (agentId: string) => {
    try {
      const res = await apiRequest(`/v1/agents/${agentId}/sessions?status=running`)
      if (res?.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      // Silent fail
    }
  }, [])
  
  useEffect(() => {
    fetchAgents()
    // Poll every 5 seconds
    const interval = setInterval(fetchAgents, 5000)
    return () => clearInterval(interval)
  }, [fetchAgents])
  
  useEffect(() => {
    if (selectedAgent) {
      fetchSessions(selectedAgent.id)
      const interval = setInterval(() => fetchSessions(selectedAgent.id), 3000)
      return () => clearInterval(interval)
    }
  }, [selectedAgent, fetchSessions])
  
  // Actions
  const handlePause = async (agentId: string) => {
    try {
      const res = await apiRequest(`/v1/agents/${agentId}/pause`, { method: 'POST' })
      if (res?.ok) {
        toast.success('Agent paused')
        fetchAgents()
      } else {
        toast.error('Failed to pause agent')
      }
    } catch {
      toast.error('Failed to pause agent')
    }
  }
  
  const handleResume = async (agentId: string) => {
    try {
      const res = await apiRequest(`/v1/agents/${agentId}/resume`, { method: 'POST' })
      if (res?.ok) {
        toast.success('Agent resumed')
        fetchAgents()
      } else {
        toast.error('Failed to resume agent')
      }
    } catch {
      toast.error('Failed to resume agent')
    }
  }
  
  const handleKillSession = async (sessionId: string) => {
    if (!selectedAgent) return
    
    try {
      const res = await apiRequest(
        `/v1/agents/${selectedAgent.id}/sessions/${sessionId}`, 
        { 
          method: 'DELETE',
          body: JSON.stringify({ reason: 'Manual kill from dashboard' })
        }
      )
      if (res?.ok) {
        const data = await res.json()
        const latency = data.latency?.kill_signal_ms || 'N/A'
        toast.success('🛑 Session terminated', { 
          description: `Kill switch activated in ${latency}ms` 
        })
        fetchSessions(selectedAgent.id)
      } else {
        toast.error('Failed to kill session')
      }
    } catch {
      toast.error('Failed to kill session')
    }
  }
  
  const handleKillAll = async (agentId: string) => {
    try {
      const res = await apiRequest(
        `/v1/agents/${agentId}/kill-all`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'Emergency kill all from dashboard' })
        }
      )
      if (res?.ok) {
        const data = await res.json()
        const latency = data.latency_ms || 'N/A'
        toast.success(`🛑 Emergency stop complete`, { 
          description: `Killed ${data.killed_count} sessions in ${latency}ms` 
        })
        fetchAgents()
        if (selectedAgent?.id === agentId) {
          fetchSessions(agentId)
        }
      } else {
        toast.error('Failed to kill sessions')
      }
    } catch {
      toast.error('Failed to kill sessions')
    }
  }
  
  const handleDelete = async (agentId: string) => {
    // Using dialog instead of confirm for better UX
    try {
      const res = await apiRequest(`/v1/agents/${agentId}`, { method: 'DELETE' })
      if (res?.ok) {
        toast.success('Agent deleted')
        fetchAgents()
        if (selectedAgent?.id === agentId) {
          setSelectedAgent(null)
        }
      } else {
        toast.error('Failed to delete agent')
      }
    } catch {
      toast.error('Failed to delete agent')
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Agents</h1>
          <p className="text-slate-500">Monitor and manage your AI agents</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchAgents}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-linear-to-r from-violet-600 to-blue-600">
            <Bot className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Bot className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-xs text-slate-500">Total Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.filter(a => a.status === 'active').length}
                </p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.reduce((sum, a) => sum + a.total_requests, 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Total Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${agents.reduce((sum, a) => sum + a.current_spend, 0).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">Total Spend</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Agents Grid + Session Panel */}
      <div className="grid grid-cols-3 gap-6">
        {/* Agents List */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Your Agents</h2>
          
          {agents.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Bot className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">No agents yet</p>
                <Button className="bg-linear-to-r from-violet-600 to-blue-600">
                  Create Your First Agent
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onPause={handlePause}
                    onResume={handleResume}
                    onKillAll={(id) => setKillDialog({ 
                      open: true, 
                      type: 'all', 
                      targetId: id 
                    })}
                    onDelete={handleDelete}
                    onSelect={setSelectedAgent}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        
        {/* Sessions Panel */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {selectedAgent ? `Sessions: ${selectedAgent.name}` : 'Select an Agent'}
          </h2>
          
          {selectedAgent ? (
            <Card>
              <CardContent className="pt-4 space-y-3">
                {sessions.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">
                    No running sessions
                  </p>
                ) : (
                  sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onKill={(id) => setKillDialog({
                        open: true,
                        type: 'session',
                        targetId: id,
                        agentId: selectedAgent.id
                      })}
                      onSelect={() => {}}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <Activity className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">
                  Click an agent to view sessions
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Kill Confirmation Dialog */}
      <KillDialog
        open={killDialog.open}
        onClose={() => setKillDialog({ ...killDialog, open: false })}
        onConfirm={() => {
          if (killDialog.type === 'session') {
            handleKillSession(killDialog.targetId)
          } else {
            handleKillAll(killDialog.targetId)
          }
          setKillDialog({ ...killDialog, open: false })
        }}
        title={killDialog.type === 'session' ? 'Kill Session?' : 'Kill All Sessions?'}
        description={
          killDialog.type === 'session'
            ? 'This will immediately terminate the session. Any in-flight requests will be rejected.'
            : 'This will immediately terminate ALL running sessions for this agent. This cannot be undone.'
        }
      />
    </div>
  )
}

export default AgentDashboard

