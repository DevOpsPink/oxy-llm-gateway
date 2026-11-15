'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type Recommendation = {
  type: string
  title: string
  description: string
  estimated_monthly_savings_usd: number
  confidence: string
  supporting_stats?: Record<string, any>
}

type OptimizerResponse = {
  window: string
  currency: string
  estimated_total_savings_usd: number
  recommendations: Recommendation[]
}

const confidenceColor = (c: string) => {
  const v = c.toLowerCase()
  if (v === 'high') return 'bg-green-100 text-green-800'
  if (v === 'medium') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-800'
}

export default function OptimizerPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OptimizerResponse | null>(null)
  const [window, setWindow] = useState('30d')
  const [limit, setLimit] = useState(10)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const fetchRecos = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('window', window)
      params.set('limit', limit.toString())
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/cost-optimizer/recommendations?${params.toString()}`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token, window, limit])

  useEffect(() => {
    fetchRecos()
  }, [fetchRecos])

  const renderList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )
    }
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not fetch recommendations. Try again. <button className="underline" onClick={fetchRecos}>Retry</button>
        </div>
      )
    }
    if (!data || !data.recommendations.length) {
      return (
        <div className="text-sm text-slate-600 border rounded-lg p-4 bg-slate-50">
          No optimization opportunities found for this window. You’re already running lean ✨
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {data.recommendations.map((rec, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{rec.type}</Badge>
                <Badge className={confidenceColor(rec.confidence)}>
                  {rec.confidence.charAt(0).toUpperCase() + rec.confidence.slice(1)}
                </Badge>
              </div>
              <div className="text-sm font-semibold text-slate-700">
                ~${rec.estimated_monthly_savings_usd.toFixed(2)} / month
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <h3 className="text-lg font-semibold">{rec.title}</h3>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
              {rec.supporting_stats && (
                <div className="text-xs text-slate-600 grid grid-cols-2 gap-2">
                  {Object.entries(rec.supporting_stats).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="font-medium">{k}</span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Optimizer" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">AI Cost Optimizer</h1>
              <p className="text-sm text-muted-foreground">
                Heuristic, usage-based recommendations. Estimates only — not a billing source of truth.
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={window} onValueChange={setWindow}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Top 5</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">
                Est. (heuristic): ${data?.estimated_total_savings_usd?.toFixed(2) ?? '0.00'}
              </Badge>
            </div>
          </div>
        </div>
        {renderList()}
      </main>
    </div>
  )
}

