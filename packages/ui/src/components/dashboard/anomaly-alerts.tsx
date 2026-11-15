'use client'

/**
 * Anomaly Alerts Dashboard Component
 * ===================================
 * 
 * Real-time anomaly detection and alerting dashboard.
 * 
 * Features:
 * - Live anomaly feed
 * - Severity-based filtering
 * - Quick actions (acknowledge, resolve)
 * - Security score widget
 * - Cost insights preview
 * 
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  Activity,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Bell,
  BellOff,
  RefreshCw,
  ChevronRight,
  Zap,
  Shield,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface Anomaly {
  id: string
  anomaly_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  entity_type: string
  entity_id: string
  description: string
  metric_value: number
  baseline_value: number
  deviation_percent: number
  status: 'new' | 'acknowledged' | 'resolved' | 'ignored'
  detected_at: string
  metadata: Record<string, any>
}

interface SecurityScore {
  score: number
  grade: string
  deductions: Array<{
    category: string
    points: number
    reason: string
  }>
  recommendations: Array<{
    priority: string
    action: string
    impact: string
  }>
}

interface CostInsights {
  summary: {
    total_cost_30d: number
    request_count_30d: number
    avg_cost_per_request: number
  }
  recommendations: Array<{
    type: string
    priority: string
    title: string
    description: string
    potential_savings: number
  }>
  potential_total_savings: number
}

// ============================================================================
// SEVERITY CONFIG
// ============================================================================

const severityConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  critical: { 
    color: 'text-red-700', 
    bgColor: 'bg-red-100 border-red-300', 
    icon: <ShieldAlert className="h-4 w-4 text-red-600" /> 
  },
  high: { 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-100 border-orange-300', 
    icon: <AlertTriangle className="h-4 w-4 text-orange-600" /> 
  },
  medium: { 
    color: 'text-amber-700', 
    bgColor: 'bg-amber-100 border-amber-300', 
    icon: <Bell className="h-4 w-4 text-amber-600" /> 
  },
  low: { 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100 border-blue-300', 
    icon: <Activity className="h-4 w-4 text-blue-600" /> 
  },
}

const anomalyTypeLabels: Record<string, string> = {
  cost_spike: '💰 Cost Spike',
  volume_spike: '📈 Volume Spike',
  budget_burn: '🔥 Budget Burn',
  dlp_pattern: '🛡️ DLP Pattern',
  session_burst: '⚡ Session Burst',
  model_shift: '🔄 Model Shift',
  tool_abuse: '🔧 Tool Abuse',
  time_anomaly: '⏰ Time Anomaly',
}

// ============================================================================
// ANOMALY CARD
// ============================================================================

const AnomalyCard = ({
  anomaly,
  onAcknowledge,
  onResolve,
  onIgnore
}: {
  anomaly: Anomaly
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
}) => {
  const config = severityConfig[anomaly.severity]
  const isNew = anomaly.status === 'new'
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`
        p-4 rounded-xl border-2 transition-all
        ${isNew ? config.bgColor : 'bg-slate-50 border-slate-200'}
        ${isNew ? 'shadow-lg' : 'shadow-sm'}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isNew ? 'bg-white' : 'bg-slate-100'}`}>
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">
                {anomalyTypeLabels[anomaly.anomaly_type] || anomaly.anomaly_type}
              </span>
              <Badge 
                className={`text-[10px] ${
                  anomaly.severity === 'critical' ? 'bg-red-600' :
                  anomaly.severity === 'high' ? 'bg-orange-500' :
                  anomaly.severity === 'medium' ? 'bg-amber-500' :
                  'bg-blue-500'
                } text-white`}
              >
                {anomaly.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {anomaly.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-700 mb-2">{anomaly.description}</p>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(anomaly.detected_at).toLocaleString()}
              </span>
              <span>
                {anomaly.deviation_percent > 0 ? '+' : ''}{anomaly.deviation_percent.toFixed(0)}% deviation
              </span>
            </div>
          </div>
        </div>
        
        {isNew && (
          <div className="flex flex-col gap-1">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7"
              onClick={() => onAcknowledge(anomaly.id)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Acknowledge
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7 text-emerald-600 hover:bg-emerald-50"
              onClick={() => onResolve(anomaly.id)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Resolve
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-xs h-7 text-slate-500 hover:text-slate-600"
              onClick={() => onIgnore(anomaly.id)}
            >
              <BellOff className="h-3 w-3 mr-1" />
              Ignore
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================================================
// SECURITY SCORE WIDGET
// ============================================================================

const SecurityScoreWidget = ({ score }: { score: SecurityScore | null }) => {
  if (!score) return null
  
  const gradeColors: Record<string, string> = {
    'A': 'text-emerald-600 bg-emerald-100',
    'B': 'text-blue-600 bg-blue-100',
    'C': 'text-amber-600 bg-amber-100',
    'D': 'text-orange-600 bg-orange-100',
    'F': 'text-red-600 bg-red-100',
  }
  
  return (
    <Card className="border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-violet-600" />
          Security Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-5xl font-bold ${gradeColors[score.grade]?.split(' ')[0] || 'text-slate-900'}`}>
            {score.score}
          </div>
          <div className={`px-3 py-1 rounded-lg text-lg font-bold ${gradeColors[score.grade] || 'bg-slate-100'}`}>
            {score.grade}
          </div>
        </div>
        
        <Progress value={score.score} className="h-2 mb-4" />
        
        {score.recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Quick Wins</p>
            {score.recommendations.slice(0, 2).map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge 
                  className={`text-[10px] ${
                    rec.priority === 'critical' ? 'bg-red-500' :
                    rec.priority === 'high' ? 'bg-orange-500' :
                    'bg-blue-500'
                  } text-white`}
                >
                  {rec.priority}
                </Badge>
                <span className="text-slate-600">{rec.action}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// COST INSIGHTS WIDGET
// ============================================================================

const CostInsightsWidget = ({ insights }: { insights: CostInsights | null }) => {
  if (!insights) return null
  
  return (
    <Card className="border-2 border-emerald-200 bg-linear-to-br from-emerald-50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          Cost Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold text-slate-900">
              ${insights.summary.total_cost_30d.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">30-day spend</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">
              ${insights.potential_total_savings.toFixed(0)}
            </p>
            <p className="text-xs text-slate-500">Potential savings</p>
          </div>
        </div>
        
        {insights.recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Optimization Tips</p>
            {insights.recommendations.slice(0, 2).map((rec, i) => (
              <div key={i} className="p-2 bg-white rounded-lg border border-emerald-100">
                <p className="text-xs font-medium text-slate-900">{rec.title}</p>
                <p className="text-[10px] text-emerald-600">
                  Save ~${rec.potential_savings.toFixed(0)}/month
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export function AnomalyAlerts() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null)
  const [costInsights, setCostInsights] = useState<CostInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('new')
  
  const fetchAnomalies = useCallback(async () => {
    try {
      let url = `/v1/intelligence/anomalies?status=${statusFilter}`
      if (severityFilter !== 'all') {
        url += `&severity=${severityFilter}`
      }
      
      const res = await apiRequest(url)
      if (res?.ok) {
        const data = await res.json()
        setAnomalies(data.anomalies || [])
      }
    } catch {
      // Silent fail
    }
  }, [severityFilter, statusFilter])
  
  const fetchSecurityScore = useCallback(async () => {
    try {
      const res = await apiRequest('/v1/intelligence/security-score')
      if (res?.ok) {
        const data = await res.json()
        setSecurityScore(data)
      }
    } catch {
      // Silent fail
    }
  }, [])
  
  const fetchCostInsights = useCallback(async () => {
    try {
      const res = await apiRequest('/v1/intelligence/cost-insights')
      if (res?.ok) {
        const data = await res.json()
        setCostInsights(data)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    fetchAnomalies()
    fetchSecurityScore()
    fetchCostInsights()
    
    // Poll for anomalies every 30 seconds
    const interval = setInterval(fetchAnomalies, 30000)
    return () => clearInterval(interval)
  }, [fetchAnomalies, fetchSecurityScore, fetchCostInsights])
  
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await apiRequest(`/v1/intelligence/anomalies/${id}?status=${status}`, {
        method: 'PATCH'
      })
      if (res?.ok) {
        toast.success(`Anomaly ${status}`)
        fetchAnomalies()
      } else {
        toast.error('Failed to update anomaly')
      }
    } catch {
      toast.error('Failed to update anomaly')
    }
  }
  
  const handleRunDetection = async () => {
    try {
      toast.info('Running anomaly detection...')
      const res = await apiRequest('/v1/intelligence/anomalies/detect', { method: 'POST' })
      if (res?.ok) {
        const data = await res.json()
        if (data.anomalies_detected > 0) {
          toast.warning(`🚨 ${data.anomalies_detected} anomalies detected!`)
        } else {
          toast.success('✅ No anomalies detected')
        }
        fetchAnomalies()
      }
    } catch {
      toast.error('Detection failed')
    }
  }
  
  // Count by severity
  const criticalCount = anomalies.filter(a => a.severity === 'critical' && a.status === 'new').length
  const highCount = anomalies.filter(a => a.severity === 'high' && a.status === 'new').length
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-violet-600" />
            Intelligence Center
          </h1>
          <p className="text-slate-500">Anomaly detection, security insights, and cost optimization</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => { fetchAnomalies(); fetchSecurityScore(); fetchCostInsights(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            className="bg-linear-to-r from-violet-600 to-blue-600"
            onClick={handleRunDetection}
          >
            <Zap className="h-4 w-4 mr-2" />
            Run Detection
          </Button>
        </div>
      </div>
      
      {/* Alert Summary */}
      {(criticalCount > 0 || highCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-linear-to-r from-red-500 to-orange-500 rounded-2xl text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 animate-pulse" />
              <div>
                <p className="font-bold">Active Alerts Requiring Attention</p>
                <p className="text-sm text-white/80">
                  {criticalCount > 0 && `${criticalCount} critical`}
                  {criticalCount > 0 && highCount > 0 && ' • '}
                  {highCount > 0 && `${highCount} high severity`}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-white text-white hover:bg-white/10"
              onClick={() => { setSeverityFilter('all'); setStatusFilter('new'); }}
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}
      
      {/* Widgets Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <SecurityScoreWidget score={securityScore} />
        <CostInsightsWidget insights={costInsights} />
      </div>
      
      {/* Anomalies Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Anomaly Alerts</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          ) : anomalies.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">All Clear! 🎉</p>
              <p className="text-sm text-slate-500">No anomalies matching your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {anomalies.map((anomaly) => (
                  <AnomalyCard
                    key={anomaly.id}
                    anomaly={anomaly}
                    onAcknowledge={(id) => handleUpdateStatus(id, 'acknowledged')}
                    onResolve={(id) => handleUpdateStatus(id, 'resolved')}
                    onIgnore={(id) => handleUpdateStatus(id, 'ignored')}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AnomalyAlerts

