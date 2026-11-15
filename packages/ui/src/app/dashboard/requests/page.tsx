'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/header'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

type RequestRow = {
  id: string
  created_at: string
  provider: string | null
  model: string
  status: string | null
  latency_ms: number | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  cost_usd: number | null
}

const formatTime = (iso: string) => new Date(iso).toLocaleString()

export default function RequestsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<RequestRow[]>([])
  const [modelFilter, setModelFilter] = useState<string>('')
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null
      setSessionToken(token)
    }).catch(() => setSessionToken(null))
  }, [supabase])

  const fetchRequests = useCallback(async () => {
    if (!sessionToken) return
    setRefreshing(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (modelFilter) params.set('model', modelFilter)
      if (providerFilter) params.set('provider', providerFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/requests?${params.toString()}`,
        { method: 'GET' },
        sessionToken
      )

      if (!res.ok) {
        const msg = await handleApiError(res)
        throw new Error(msg)
      }

      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sessionToken, modelFilter, providerFilter, statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const uniqueModels = Array.from(new Set(items.map(i => i.model).filter(Boolean)))
  const uniqueProviders = Array.from(new Set(items.map(i => i.provider || '').filter(Boolean)))
  const uniqueStatuses = Array.from(new Set(items.map(i => i.status || '').filter(Boolean)))

  const statusColor = (status?: string | null) => {
    if (!status) return 'secondary'
    const s = status.toLowerCase()
    if (s.includes('error') || s.startsWith('4') || s.startsWith('5')) return 'destructive'
    return 'secondary'
  }

  const renderTable = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )
    }

    if (error) {
      return (
        <Card>
          <CardContent className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Unable to load requests</p>
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (!items.length) {
      return (
        <Card>
          <CardContent className="text-center text-sm text-slate-600 py-10">
            No requests yet — try sending a request via your API key.
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Latency (ms)</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Cost (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">{formatTime(item.created_at)}</TableCell>
                <TableCell>{item.provider || '—'}</TableCell>
                <TableCell>{item.model}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(item.status)} className="capitalize">
                    {item.status || 'unknown'}
                  </Badge>
                </TableCell>
                <TableCell>{item.latency_ms ?? '—'}</TableCell>
                <TableCell>
                  <div className="text-xs text-slate-600 leading-tight">
                    <div>Prompt: {item.prompt_tokens ?? 0}</div>
                    <div>Completion: {item.completion_tokens ?? 0}</div>
                    <div className="font-medium text-slate-900">Total: {item.total_tokens ?? 0}</div>
                  </div>
                </TableCell>
                <TableCell>${(item.cost_usd ?? 0).toFixed(4)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Requests" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl">Requests</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchRequests} disabled={refreshing || loading || !sessionToken}>
                  <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!sessionToken || exporting}
                  onClick={async () => {
                    if (!sessionToken) return
                    setExporting(true)
                    try {
                      const params = new URLSearchParams()
                      if (modelFilter) params.set('model', modelFilter)
                      if (providerFilter) params.set('provider', providerFilter)
                      if (statusFilter) params.set('status', statusFilter)
                      params.set('limit', '50000')
                      const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/exports/requests.csv?${params.toString()}`
                      const res = await authenticatedFetch(url, {}, sessionToken)
                      if (!res.ok) throw new Error(await handleApiError(res))
                      const blob = await res.blob()
                      const href = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = href
                      a.download = `oxy-requests-${new Date().toISOString().slice(0, 10)}.csv`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(href)
                    } catch (err) {
                      console.error('Failed to export CSV', err)
                      alert('Failed to export CSV')
                    } finally {
                      setExporting(false)
                    }
                  }}
                >
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All providers</SelectItem>
                  {uniqueProviders.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All models</SelectItem>
                  {uniqueModels.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All status</SelectItem>
                  {uniqueStatuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {renderTable()}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

