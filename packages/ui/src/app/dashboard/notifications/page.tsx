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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Settings = {
  alerts_email: string | null
  budget_email_enabled: boolean
  anomaly_email_enabled: boolean
  slack_webhook_url: string | null
  slack_enabled: boolean
  discord_webhook_url: string | null
  discord_enabled: boolean
}

type Webhook = {
  id: string
  url: string
  event_types: string[]
  created_at?: string
  disabled_at?: string | null
}

const EVENT_OPTIONS = [
  { value: 'budget.threshold_crossed', label: 'Budget threshold crossed' },
  { value: 'anomaly.raised', label: 'Anomaly raised' },
  { value: 'request.created', label: 'Request created' },
]

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [slackError, setSlackError] = useState<string | null>(null)
  const [discordError, setDiscordError] = useState<string | null>(null)

  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [whLoading, setWhLoading] = useState(false)
  const [whError, setWhError] = useState<string | null>(null)

  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>(['budget.threshold_crossed'])
  const [creatingWh, setCreatingWh] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token || null)).catch(() => setToken(null))
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
        alerts_email: json.alerts_email ?? '',
        budget_email_enabled: json.budget_email_enabled ?? true,
        anomaly_email_enabled: json.anomaly_email_enabled ?? true,
        slack_webhook_url: json.slack_webhook_url ?? '',
        slack_enabled: json.slack_enabled ?? false,
        discord_webhook_url: json.discord_webhook_url ?? '',
        discord_enabled: json.discord_enabled ?? false,
      })
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchWebhooks = useCallback(async () => {
    if (!token) return
    setWhLoading(true)
    setWhError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/webhooks`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setWebhooks(json.webhooks || [])
    } catch (err) {
      setWhError(safeErrorMessage(err))
    } finally {
      setWhLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSettings()
    fetchWebhooks()
  }, [fetchSettings, fetchWebhooks])

  const saveSettings = async () => {
    if (!token || !settings) return
    setSlackError(null)
    setDiscordError(null)
    if (settings.slack_enabled && !(settings.slack_webhook_url || '').startsWith('https://hooks.slack.com/')) {
      setSlackError('Slack webhook must start with https://hooks.slack.com/.')
      return
    }
    if (
      settings.discord_enabled &&
      !(
        (settings.discord_webhook_url || '').startsWith('https://discord.com/api/webhooks/') ||
        (settings.discord_webhook_url || '').startsWith('https://discordapp.com/api/webhooks/')
      )
    ) {
      setDiscordError('Discord webhook must start with https://discord.com/api/webhooks/.')
      return
    }
    setSaving(true)
    const payload = {
        ...settings,
        slack_webhook_url: settings.slack_webhook_url?.trim() || null,
        discord_webhook_url: settings.discord_webhook_url?.trim() || null,
      }
    try {
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

  const createWebhook = async () => {
    if (!token || !newUrl.trim()) return
    setCreatingWh(true)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/webhooks`,
        { method: 'POST', body: JSON.stringify({ url: newUrl.trim(), event_types: newEvents }) },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      setNewUrl('')
      setNewEvents(['budget.threshold_crossed'])
      fetchWebhooks()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setCreatingWh(false)
    }
  }

  const deleteWebhook = async (id: string) => {
    if (!token) return
    if (!confirm('Delete this webhook?')) return
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/webhooks/${id}`,
        { method: 'DELETE' },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      fetchWebhooks()
    } catch (err) {
      alert(safeErrorMessage(err))
    }
  }

  const renderSettings = () => {
    if (loading) return <Skeleton className="h-32 w-full" />
    if (error) {
      return (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <span>Could not load settings.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-red-600 underline-offset-4" onClick={fetchSettings}>
            Retry
          </Button>
        </div>
      )
    }
    if (!settings) return null
    return (
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Alerts email</Label>
              <Input
                placeholder="alerts@example.com"
                value={settings.alerts_email || ''}
                onChange={(e) => setSettings({ ...settings, alerts_email: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.budget_email_enabled}
                onCheckedChange={(v) => setSettings({ ...settings, budget_email_enabled: v })}
                id="budget"
              />
              <Label htmlFor="budget">Send budget alerts (80%, 95%, 100%)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.anomaly_email_enabled}
                onCheckedChange={(v) => setSettings({ ...settings, anomaly_email_enabled: v })}
                id="anomaly"
              />
              <Label htmlFor="anomaly">Send anomaly alerts</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Email is the primary channel. Delivery is best-effort and may be rate limited by your provider.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slack & Discord (best-effort)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.slack_enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, slack_enabled: v })}
                  id="slack"
                />
                <Label htmlFor="slack">Send alerts to Slack</Label>
              </div>
              <Input
                placeholder="https://hooks.slack.com/..."
                value={settings.slack_webhook_url || ''}
                onChange={(e) => setSettings({ ...settings, slack_webhook_url: e.target.value })}
              />
              {slackError && <p className="text-xs text-red-600">{slackError}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.discord_enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, discord_enabled: v })}
                  id="discord"
                />
                <Label htmlFor="discord">Send alerts to Discord</Label>
              </div>
              <Input
                placeholder="https://discord.com/api/webhooks/..."
                value={settings.discord_webhook_url || ''}
                onChange={(e) => setSettings({ ...settings, discord_webhook_url: e.target.value })}
              />
              {discordError && <p className="text-xs text-red-600">{discordError}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              Best-effort outbound webhooks for budget and anomaly alerts. Delivery is not guaranteed; keep email/webhooks as
              primary channels.
            </p>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderWebhooks = () => {
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <p className="text-sm text-muted-foreground">Send alerts to Slack or your backend via webhook URL.</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="https://hooks.slack.com/..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
                <Label>Event types</Label>
                <Select onValueChange={(v) => {
                  if (!newEvents.includes(v)) setNewEvents([v])
                }} value={newEvents[0]}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={createWebhook} disabled={creatingWh || !newUrl.trim()}>
                  {creatingWh ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {whLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : whError ? (
          <div className="text-sm text-red-600 flex items-center gap-2">
            <span>Could not load webhooks.</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-red-600 underline-offset-4" onClick={fetchWebhooks}>
              Retry
            </Button>
          </div>
          ) : webhooks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No webhooks yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-xs break-all">{w.url}</TableCell>
                    <TableCell className="space-x-1">
                      {w.event_types?.map((ev) => (
                        <Badge key={ev} variant="outline">{ev}</Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.created_at ? new Date(w.created_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => deleteWebhook(w.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Notifications" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Notifications & Webhooks</h1>
          <p className="text-sm text-muted-foreground">Control how Oxy alerts you about budgets, anomalies, and events.</p>
        </div>
        {renderSettings()}
        {renderWebhooks()}
      </main>
    </div>
  )
}

