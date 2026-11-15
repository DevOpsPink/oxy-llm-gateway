'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

type AttributionItem = {
  tag: string
  label?: string | null
  total_cost_usd: number
  request_count: number
  avg_cost_usd: number
}

type AttributionSummary = {
  from: string
  to: string
  attribution_key: string
  items: AttributionItem[]
}

const presets = [
  { label: 'This month', value: 'month' },
  { label: 'Last 7 days', value: '7d' },
]

export default function AttributionPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AttributionSummary | null>(null)
  const [preset, setPreset] = useState('month')
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const computeRange = () => {
    const now = new Date()
    if (preset === '7d') {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { from, to: now }
    }
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { from, to: now }
  }

  const fetchSummary = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const { from, to } = computeRange()
      const params = new URLSearchParams()
      params.set('from', from.toISOString())
      params.set('to', to.toISOString())
      params.set('limit', limit.toString())
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/attribution/summary?${params.toString()}`,
        {},
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token, preset, limit])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const renderTable = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      )
    }
    if (error) {
      return (
        <Card>
          <CardContent className="text-sm text-red-600 flex items-center gap-2">
            <span>Failed to load attribution: {error}</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-red-600 underline-offset-4" onClick={fetchSummary}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )
    }
    if (!data || !data.items.length) {
      return (
        <Card>
          <CardContent className="text-sm text-slate-600 p-4">
            No cost attribution data yet. Once your agents start calling the gateway with tags, you’ll see spend by customer/team here.
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
                <TableHead>Tag</TableHead>
                <TableHead>Total Cost (USD)</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Avg Cost / Req</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.tag}>
                  <TableCell>
                    <div className="font-medium">{item.tag}</div>
                    {item.label && <div className="text-xs text-muted-foreground">{item.label}</div>}
                  </TableCell>
                  <TableCell>${item.total_cost_usd.toFixed(4)}</TableCell>
                  <TableCell>{item.request_count}</TableCell>
                  <TableCell>${item.avg_cost_usd.toFixed(4)}</TableCell>
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
      <Header title="Attribution" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">Cost Attribution</h1>
          <p className="text-sm text-muted-foreground">
            Top tags by spend, grouped by cost attribution tags on your requests.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Top tags by spend</CardTitle>
          </CardHeader>
          <CardContent>
            {renderTable()}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

