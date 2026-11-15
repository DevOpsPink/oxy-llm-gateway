'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

type Settings = {
  zapier_webhook_url: string | null
  zapier_enabled: boolean
  zapier_events: string[]
}

const EVENT_OPTIONS = [
  { value: 'budget.threshold_crossed', label: 'Budget threshold crossed' },
  { value: 'anomaly.raised', label: 'Anomaly raised' },
]

export default function IntegrationsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setToken(data.session?.access_token || null))
      .catch(() => setToken(null))
  }, [supabase])

  const fetchSettings = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/notifications/settings`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setSettings({
        zapier_webhook_url: json.zapier_webhook_url ?? '',
        zapier_enabled: json.zapier_enabled ?? false,
        zapier_events: json.zapier_events ?? ['budget.threshold_crossed', 'anomaly.raised'],
      })
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const save = async () => {
    if (!token || !settings) return
    setUrlError(null)
    const trimmedUrl = settings.zapier_webhook_url?.trim() || ''
    if (settings.zapier_enabled && !trimmedUrl.startsWith('https://hooks.zapier.com/')) {
      setUrlError('Zapier webhook must start with https://hooks.zapier.com/.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        zapier_enabled: settings.zapier_enabled,
        zapier_webhook_url: trimmedUrl || null,
        zapier_events: settings.zapier_events,
      }
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/notifications/settings`,
        { method: 'POST', body: JSON.stringify(payload) },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      await fetchSettings()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleEvent = (value: string) => {
    if (!settings) return
    const exists = settings.zapier_events.includes(value)
    const updated = exists ? settings.zapier_events.filter((v) => v !== value) : [...settings.zapier_events, value]
    setSettings({ ...settings, zapier_events: updated })
  }

  const renderContent = () => {
    if (loading) return <Skeleton className="h-48 w-full" />
    if (error) {
      return (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <span>Could not load Zapier settings.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-red-600 underline-offset-4" onClick={fetchSettings}>
            Retry
          </Button>
        </div>
      )
    }
    if (!settings) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zapier</CardTitle>
          <p className="text-sm text-muted-foreground">
            Best-effort outbound alerts to Zapier. Delivery is not guaranteed; keep email/webhooks as primary channels.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.zapier_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, zapier_enabled: v })}
              id="zapier"
            />
            <Label htmlFor="zapier">Enable Zapier</Label>
          </div>
          <div className="space-y-2">
            <Label>Zapier webhook URL</Label>
            <Input
              placeholder="https://hooks.zapier.com/..."
              value={settings.zapier_webhook_url || ''}
              onChange={(e) => setSettings({ ...settings, zapier_webhook_url: e.target.value })}
            />
            {urlError && <p className="text-xs text-red-600">{urlError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Events to send</Label>
            <div className="space-y-2">
              {EVENT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={settings.zapier_events.includes(opt.value)} onCheckedChange={() => toggleEvent(opt.value)} />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Payloads include minimal metadata (IDs, names, spend/thresholds) — no prompts or secrets.
            </p>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Integrations" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">Configure outbound automation via Zapier.</p>
        </div>
        {renderContent()}
      </main>
    </div>
  )
}
