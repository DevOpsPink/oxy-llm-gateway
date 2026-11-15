'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

type GuardrailsState = {
  paused: boolean
  auto_suspend_on_cost_spikes: boolean
  last_paused_at?: string | null
  last_pause_reason?: string | null
}

export default function GuardrailsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [state, setState] = useState<GuardrailsState | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const fetchState = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/guardrails`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const data = await res.json()
      setState({
        paused: !!data.paused,
        auto_suspend_on_cost_spikes: !!data.auto_suspend_on_cost_spikes,
        last_paused_at: data.last_paused_at,
        last_pause_reason: data.last_pause_reason,
      })
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  const updateState = async (partial: Partial<GuardrailsState>) => {
    if (!token) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/guardrails`,
        {
          method: 'POST',
          body: JSON.stringify(partial),
        },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const data = await res.json()
      setState({
        paused: !!data.paused,
        auto_suspend_on_cost_spikes: !!data.auto_suspend_on_cost_spikes,
        last_paused_at: data.last_paused_at,
        last_pause_reason: data.last_pause_reason,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const renderStatus = () => {
    if (!state) return null
    const isPaused = state.paused
    return (
      <div className={`flex items-center gap-2 text-sm font-medium ${isPaused ? 'text-red-600' : 'text-emerald-600'}`}>
        {isPaused ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        Status: {isPaused ? 'Paused (Kill Switch active)' : 'Active'}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Guardrails" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <CardTitle>Guardrails & Kill Switch</CardTitle>
            {renderStatus()}
            {state?.last_pause_reason && (
              <div className="text-xs text-slate-600">
                Last paused: {state.last_pause_reason} {state.last_paused_at ? `at ${new Date(state.last_paused_at).toLocaleString()}` : ''}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-60" />
                <Skeleton className="h-10 w-72" />
              </div>
            ) : error ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            ) : state ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="paused">Pause all requests (Kill Switch)</Label>
                    <p className="text-xs text-slate-600">Blocks all API traffic for this organization.</p>
                  </div>
                  <Switch
                    id="paused"
                    checked={state.paused}
                    onCheckedChange={(checked) => updateState({ paused: checked })}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-suspend">Auto-suspend on cost spikes</Label>
                    <p className="text-xs text-slate-600">Heuristic spike detection vs baseline; pauses use the same path as budgets/kill-switch. Estimates only.</p>
                  </div>
                  <Switch
                    id="auto-suspend"
                    checked={state.auto_suspend_on_cost_spikes}
                    onCheckedChange={(checked) => updateState({ auto_suspend_on_cost_spikes: checked })}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={fetchState} disabled={saving}>
                    Refresh
                  </Button>
                  {saved && <span className="text-xs text-emerald-600">Saved</span>}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle>Geo-blocking (best-effort, env-managed)</CardTitle>
            <p className="text-sm text-slate-600">
              Header/IP-based control. Configure via deployment env (ENABLE_GEO_BLOCKING, GEO_BLOCKED_COUNTRIES, GEO_FAIL_OPEN_ON_UNKNOWN). This UI is read-only to keep behavior aligned with infra.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="geo-enabled">Geo-blocking enabled</Label>
                <p className="text-xs text-slate-600">Managed via ENABLE_GEO_BLOCKING.</p>
              </div>
              <Switch id="geo-enabled" checked disabled />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="geo-blocked-countries">Blocked countries (ISO)</Label>
                <Textarea
                  id="geo-blocked-countries"
                  value="KP, IR, SY, CU (baseline) — override via GEO_BLOCKED_COUNTRIES"
                  disabled
                  className="min-h-[88px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="geo-status-code">Block status code</Label>
                <Input id="geo-status-code" value="451 (default; set GEO_BLOCK_STATUS_CODE)" disabled />
                <Label htmlFor="geo-fail-open" className="flex items-center gap-2 text-sm font-normal">
                  <Switch id="geo-fail-open" checked disabled />
                  Allow + log when country unknown (GEO_FAIL_OPEN_ON_UNKNOWN=true)
                </Label>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Signals: CF-IPCountry (preferred) → X-Country-Code/X-Geo-Country → optional IP lookup (off by default). Best-effort only; not a sanctions/compliance guarantee. Do not rely on this as the sole control.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

