'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

type PrivacyState = {
  privacy_mode: string
  request_log_retention_days: number
}

const retentionOptions = [30, 90, 365, 2555]

export default function PrivacyPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [state, setState] = useState<PrivacyState | null>(null)

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
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/privacy`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const data = await res.json()
      setState(data)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  const save = async () => {
    if (!token || !state) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/privacy`,
        { method: 'POST', body: JSON.stringify(state) },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const data = await res.json()
      setState(data)
      setSaved(true)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const renderBody = () => {
    if (loading) {
      return <Skeleton className="h-48 w-full" />
    }
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not load privacy settings. <button className="underline" onClick={fetchState}>Retry</button>
        </div>
      )
    }
    if (!state) return null

    return (
      <div className="space-y-6">
          <Card>
          <CardHeader>
            <CardTitle>Privacy mode</CardTitle>
            <p className="text-sm text-muted-foreground">Control how much data Oxy stores about your AI traffic.</p>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.privacy_mode}
              onValueChange={(v) => setState({ ...state, privacy_mode: v })}
              className="space-y-3"
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="zero_prompt_logging" id="zpl" />
                <Label htmlFor="zpl" className="space-y-1">
                  <div className="font-medium">No prompt logging (Zero Prompt Logging)</div>
                  <div className="text-sm text-muted-foreground">Strongest privacy: Oxy never stores prompts or responses. Some analytics may be less detailed.</div>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="metadata_only" id="meta" />
                <Label htmlFor="meta" className="space-y-1">
                  <div className="font-medium">Metadata only (default)</div>
                  <div className="text-sm text-muted-foreground">Balanced: only metadata, token counts, and costs. No raw prompts.</div>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="debug_full" id="debug" />
                <Label htmlFor="debug" className="space-y-1">
                  <div className="font-medium">Debug (store full prompts – dev only)</div>
                  <div className="text-sm text-muted-foreground">For debugging only. Do not use in production for real user data.</div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit & request logs</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configurable, per-org retention (min 7, default 365, max 2555 days). Content stored respects privacy mode: zero_prompt_logging and metadata_only drop prompt/response snapshots; debug_full stores snapshots only when explicitly enabled.
            </p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Retention days</Label>
              <Select
                value={(state?.request_log_retention_days ?? 365).toString()}
                onValueChange={(v) => setState({ ...(state as PrivacyState), request_log_retention_days: Number(v) })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Retention days" />
                </SelectTrigger>
                <SelectContent>
                  {[30, 90, 365, 730, 2555].map((d) => (
                    <SelectItem key={d} value={d.toString()}>{d} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Policy-driven retention; “long-term” depends on configuration or add-on.</p>
            </div>
            <div className="space-y-2">
              <Label>Current mode</Label>
              <div className="text-sm text-muted-foreground">
                {state?.privacy_mode === 'zero_prompt_logging' && 'No prompts/responses stored; metadata only.'}
                {state?.privacy_mode === 'metadata_only' && 'Metadata only; prompt/response snapshots dropped.'}
                {state?.privacy_mode === 'debug_full' && 'Snapshots stored only if debug logging explicitly enabled (OXY_DEBUG_FULL_LOGS=true).'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data retention</CardTitle>
            <p className="text-sm text-muted-foreground">Older request logs will be automatically deleted after this many days.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-center">
            <Select
              value={state.request_log_retention_days.toString()}
              onValueChange={(v) => setState({ ...state, request_log_retention_days: Number(v) })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Retention days" />
              </SelectTrigger>
              <SelectContent>
                {retentionOptions.map((d) => (
                  <SelectItem key={d} value={d.toString()}>{d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">2555 days (multi-year retention)</div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          {saved && <span className="text-sm text-green-600">Settings saved</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Privacy" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Privacy & Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Configure zero prompt logging, metadata-only mode, and log retention.
          </p>
        </div>
        {renderBody()}
      </main>
    </div>
  )
}

