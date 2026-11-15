'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type Anomaly = {
  id: string
  type: string
  severity: string
  detected_at: string
  description: string
}

type TopModel = { model: string; requests: number; cost_usd: number }
type TopProject = { project_id: string; name: string; cost_usd: number }

type IntelligenceOverview = {
  anomalies: Anomaly[]
  cost_insights: {
    top_models: TopModel[]
    top_projects: TopProject[]
    month_to_date_cost_usd: number
  }
  forecast: {
    month_to_date_cost_usd: number
    projected_end_of_month_cost_usd: number
  }
  security_score: {
    grade: string
    details: { key: string; label: string; status: string }[]
  }
}

const severityColor = (severity: string) => {
  if (severity === 'critical') return 'bg-red-100 text-red-800'
  if (severity === 'warning') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-800'
}

export default function IntelligencePage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<IntelligenceOverview | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setToken(data.session?.access_token || null))
      .catch(() => setToken(null))
  }, [supabase])

  const fetchOverview = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/intelligence/overview`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const handleExport = async () => {
    if (!token) return
    setExporting(true)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/exports/requests.csv`, {}, token)
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
  }

  const renderSummary = () => {
    if (!data) return null
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Month-to-date spend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              ${data.cost_insights.month_to_date_cost_usd.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projected end-of-month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              ${data.forecast.projected_end_of_month_cost_usd.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Simple linear projection (not a billing guarantee).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security grade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.security_score.grade}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {data.security_score.details.slice(0, 3).map((d) => (
                <li key={d.key}>{d.label}: {d.status}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderAnomalies = () => {
    if (!data) return null
    const anomalies = data.anomalies || []
    if (!anomalies.length) {
      return <p className="text-sm text-muted-foreground">No anomalies yet — your AI is behaving nicely.</p>
    }
    return (
      <div className="space-y-3">
        {anomalies.map((a) => (
          <div key={a.id} className="flex items-start justify-between rounded-lg border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className={severityColor(a.severity)}>{a.severity}</Badge>
                <span className="text-sm font-medium">{a.type}</span>
              </div>
              <p className="text-sm text-muted-foreground">{a.description}</p>
              <p className="text-xs text-muted-foreground">{new Date(a.detected_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderTopModels = () => {
    if (!data) return null
    return (
      <div className="space-y-2">
        {data.cost_insights.top_models.map((m) => (
          <div key={m.model} className="flex items-center justify-between rounded border p-2">
            <div>
              <p className="text-sm font-medium">{m.model}</p>
              <p className="text-xs text-muted-foreground">{m.requests} requests</p>
            </div>
            <p className="text-sm font-semibold">${m.cost_usd.toFixed(2)}</p>
          </div>
        ))}
      </div>
    )
  }

  const renderTopProjects = () => {
    if (!data) return null
    return (
      <div className="space-y-2">
        {data.cost_insights.top_projects.map((p) => (
          <div key={p.project_id} className="flex items-center justify-between rounded border p-2">
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.project_id}</p>
            </div>
            <p className="text-sm font-semibold">${p.cost_usd.toFixed(2)}</p>
          </div>
        ))}
      </div>
    )
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )
    }
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Failed to load intelligence overview: {error}
          <button className="ml-2 underline" onClick={fetchOverview}>Retry</button>
        </div>
      )
    }
    if (!data) {
      return <p className="text-sm text-muted-foreground">No intelligence data yet.</p>
    }
    return (
      <div className="space-y-6">
        {renderSummary()}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent anomalies</CardTitle>
            </CardHeader>
            <CardContent>{renderAnomalies()}</CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top models by cost</CardTitle>
              </CardHeader>
              <CardContent>{renderTopModels()}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top projects by cost</CardTitle>
              </CardHeader>
              <CardContent>{renderTopProjects()}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Anomaly detection, cost insights, forecasting, and security score. Heuristic/advisory only — not billing truth or a monitoring/SOC SLA.
          </p>
          <div className="mt-3">
            <button
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
              onClick={handleExport}
              disabled={!token || exporting}
            >
              {exporting ? 'Exporting…' : 'Export raw requests CSV'}
            </button>
          </div>
        </div>
        {renderBody()}
      </main>
    </div>
  )
}

