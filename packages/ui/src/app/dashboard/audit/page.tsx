'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type AuditEvent = {
  id: string
  created_at: string
  event_type: string
  actor_type: string
  actor_id?: string | null
  metadata?: Record<string, any>
}

export default function AuditPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [limit, setLimit] = useState(50)
  const [eventType, setEventType] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const fetchEvents = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      if (eventType) params.set('event_type', eventType)
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/audit/logs?${params.toString()}`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setEvents(json.events || [])
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token, limit, eventType])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const renderRows = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )
    }
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not load audit events. <button className="underline" onClick={fetchEvents}>Retry</button>
        </div>
      )
    }
    if (!events.length) {
      return (
        <div className="text-sm text-slate-600 border rounded-lg p-4 bg-slate-50">
          No audit events yet. Try changing a setting in Guardrails or Privacy.
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {events.map((e) => (
          <Card key={e.id}>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{e.event_type}</Badge>
                <Badge variant="secondary">{e.actor_type || 'unknown'}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-700">
              {e.metadata ? JSON.stringify(e.metadata) : 'No metadata'}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Audit Log" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Admin/security changes recorded for your org.</p>
          <div className="flex gap-3 flex-wrap">
            <Select value={eventType} onValueChange={(v) => setEventType(v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All events</SelectItem>
                <SelectItem value="guardrails.updated">Guardrails</SelectItem>
                <SelectItem value="privacy.updated">Privacy</SelectItem>
              </SelectContent>
            </Select>
            <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">Showing {events.length} events</Badge>
          </div>
        </div>
        {renderRows()}
      </main>
    </div>
  )
}

