'use client'

/**
 * Tool Marketplace Component
 * ==========================
 * 
 * Browse and manage MCP tools and integrations.
 * 
 * Features:
 * - Tool discovery
 * - Public tool library
 * - Tool permissions
 * - Usage analytics
 * 
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wrench,
  Search,
  Filter,
  Plus,
  ExternalLink,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  Download,
  Settings,
  ChevronRight,
  Globe,
  Lock,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

// ============================================================================
// TYPES
// ============================================================================

interface Tool {
  id: string
  name: string
  description: string
  tool_type: 'mcp' | 'api' | 'webhook' | 'function' | 'builtin'
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  requires_approval: boolean
  is_public: boolean
  is_verified: boolean
  usage_count: number
  success_rate: number
  avg_duration_ms?: number
  mcp_server_url?: string
  parameters_schema: Record<string, any>
  created_at: string
}

interface MCPServer {
  id: string
  name: string
  description?: string
  server_url: string
  is_active: boolean
  tools_count: number
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  created_at: string
}

// ============================================================================
// RISK BADGE
// ============================================================================

const RiskBadge = ({ level }: { level: string }) => {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    low: { color: 'bg-emerald-100 text-emerald-700', icon: <ShieldCheck className="h-3 w-3" /> },
    medium: { color: 'bg-amber-100 text-amber-700', icon: <Shield className="h-3 w-3" /> },
    high: { color: 'bg-orange-100 text-orange-700', icon: <ShieldAlert className="h-3 w-3" /> },
    critical: { color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
  }
  
  const c = config[level] || config.low
  
  return (
    <Badge className={`${c.color} flex items-center gap-1`}>
      {c.icon}
      {level}
    </Badge>
  )
}

// ============================================================================
// TOOL CARD
// ============================================================================

const ToolCard = ({
  tool,
  onConfigure,
  onToggle
}: {
  tool: Tool
  onConfigure: (tool: Tool) => void
  onToggle: (tool: Tool) => void
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className="relative"
    >
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                ${tool.tool_type === 'mcp' ? 'bg-violet-100 text-violet-600' : 
                  tool.tool_type === 'api' ? 'bg-blue-100 text-blue-600' : 
                  'bg-slate-100 text-slate-600'}
              `}>
                <Wrench className="h-5 w-5" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{tool.name}</CardTitle>
                  {tool.is_verified && (
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <CardDescription className="text-xs line-clamp-1">
                  {tool.description}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <RiskBadge level={tool.risk_level} />
              {tool.is_public ? (
                <Globe className="h-3 w-3 text-slate-500" />
              ) : (
                <Lock className="h-3 w-3 text-slate-500" />
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-2">
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {tool.usage_count.toLocaleString()} uses
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {tool.success_rate.toFixed(1)}%
            </span>
            {tool.avg_duration_ms && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {tool.avg_duration_ms}ms
              </span>
            )}
          </div>
          
          {/* Type Badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {tool.tool_type.toUpperCase()}
            </Badge>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7"
                onClick={() => onConfigure(tool)}
              >
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// MCP SERVER CARD
// ============================================================================

const MCPServerCard = ({
  server,
  onRefresh,
  onDelete
}: {
  server: MCPServer
  onRefresh: (id: string) => void
  onDelete: (id: string) => void
}) => {
  const healthColor = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-slate-400'
  }
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${healthColor[server.health_status]}`} />
            
            <div>
              <p className="font-medium">{server.name}</p>
              <p className="text-xs text-slate-500">{server.server_url}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">{server.tools_count} tools</Badge>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onRefresh(server.id)}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// ADD MCP SERVER DIALOG
// ============================================================================

const AddMCPServerDialog = ({
  open,
  onClose,
  onAdd
}: {
  open: boolean
  onClose: () => void
  onAdd: (data: { name: string; server_url: string; description: string }) => void
}) => {
  const [name, setName] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async () => {
    setLoading(true)
    await onAdd({ name, server_url: serverUrl, description })
    setLoading(false)
    setName('')
    setServerUrl('')
    setDescription('')
    onClose()
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Connect an MCP server to discover and use its tools.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Server Name</label>
            <Input 
              placeholder="My MCP Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Server URL</label>
            <Input 
              placeholder="http://localhost:3001"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input 
              placeholder="What does this server do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit}
            disabled={!name || !serverUrl || loading}
            className="bg-linear-to-r from-violet-600 to-blue-600"
          >
            {loading ? 'Connecting...' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ToolMarketplace() {
  const [tools, setTools] = useState<Tool[]>([])
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [addServerOpen, setAddServerOpen] = useState(false)
  
  // Fetch tools
  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/mcp/tools?include_public=true', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setTools(data.tools || [])
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    }
  }, [])
  
  // Fetch MCP servers
  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/mcp/servers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setServers(data.servers || [])
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    fetchTools()
    fetchServers()
  }, [fetchTools, fetchServers])
  
  // Add MCP server
  const handleAddServer = async (data: { name: string; server_url: string; description: string }) => {
    try {
      const res = await fetch('/api/v1/mcp/servers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      
      if (res.ok) {
        const result = await res.json()
        toast.success(`Added ${result.tools_registered} tools from ${data.name}`)
        fetchServers()
        fetchTools()
      } else {
        const error = await res.json()
        toast.error(error.detail || 'Failed to add server')
      }
    } catch (error) {
      toast.error('Failed to add server')
    }
  }
  
  // Filter tools
  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase()) ||
                         tool.description.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || tool.tool_type === filter
    return matchesSearch && matchesFilter
  })
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tool Marketplace</h1>
          <p className="text-slate-500">Discover and manage MCP tools and integrations</p>
        </div>
        
        <Button 
          className="bg-linear-to-r from-violet-600 to-blue-600"
          onClick={() => setAddServerOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add MCP Server
        </Button>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="tools">
        <TabsList>
          <TabsTrigger value="tools">
            <Wrench className="h-4 w-4 mr-2" />
            Tools ({tools.length})
          </TabsTrigger>
          <TabsTrigger value="servers">
            <Globe className="h-4 w-4 mr-2" />
            MCP Servers ({servers.length})
          </TabsTrigger>
        </TabsList>
        
        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          {/* Search & Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Search tools..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="mcp">MCP</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="function">Function</SelectItem>
                <SelectItem value="builtin">Built-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Tools Grid */}
          {filteredTools.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Wrench className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">No tools found</p>
                <Button onClick={() => setAddServerOpen(true)}>
                  Add MCP Server
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onConfigure={() => {}}
                    onToggle={() => {}}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
        
        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          {servers.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Globe className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">No MCP servers connected</p>
                <Button onClick={() => setAddServerOpen(true)}>
                  Add Your First Server
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onRefresh={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Add Server Dialog */}
      <AddMCPServerDialog
        open={addServerOpen}
        onClose={() => setAddServerOpen(false)}
        onAdd={handleAddServer}
      />
    </div>
  )
}

export default ToolMarketplace

