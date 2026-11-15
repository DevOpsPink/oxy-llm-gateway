'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'

type Org = {
  id: string
  display_name?: string | null
  slug?: string | null
  logo_url?: string | null
  timezone?: string | null
  locale?: string | null
  support_email?: string | null
  billing_email?: string | null
  key_rotation_days?: number | null
  key_rotation_enforcement_mode?: 'off' | 'warn' | 'enforce' | null
  key_rotation_grace_days?: number | null
}

export default function OrgSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [org, setOrg] = useState<Org | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token || null)).catch(() => setToken(null))
  }, [supabase])

  const fetchOrg = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/org`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setOrg(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchOrg()
  }, [fetchOrg])

  const saveOrg = async () => {
    if (!token || !org) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/org`,
        { method: 'POST', body: JSON.stringify(org) },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setOrg(json)
      setSaved(true)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const renderForm = () => {
    if (loading) return <Skeleton className="h-64 w-full" />
    if (error) {
      return (
        <div className="text-sm text-red-600">
          Could not load organization. <button className="underline" onClick={fetchOrg}>Retry</button>
        </div>
      )
    }
    if (!org) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <p className="text-sm text-muted-foreground">Name, branding, and contact details for your workspace.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Organization name</Label>
              <Input
                value={org.display_name || ''}
                onChange={(e) => setOrg({ ...org, display_name: e.target.value })}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1">
              <Label>Slug / handle</Label>
              <Input
                value={org.slug || ''}
                onChange={(e) => setOrg({ ...org, slug: e.target.value })}
                placeholder="acme"
              />
              <p className="text-xs text-muted-foreground">Used in URLs and internal references.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Logo URL</Label>
              <Input
                value={org.logo_url || ''}
                onChange={(e) => setOrg({ ...org, logo_url: e.target.value })}
                placeholder="https://cdn.acme.com/logo.svg"
              />
            </div>
            <div className="space-y-1">
              <Label>Timezone</Label>
              <Input
                value={org.timezone || ''}
                onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
                placeholder="UTC"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Locale</Label>
              <Input
                value={org.locale || ''}
                onChange={(e) => setOrg({ ...org, locale: e.target.value })}
                placeholder="en-US"
              />
            </div>
            <div className="space-y-1">
              <Label>Support email</Label>
              <Input
                value={org.support_email || ''}
                onChange={(e) => setOrg({ ...org, support_email: e.target.value })}
                placeholder="support@acme.com"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Billing email</Label>
            <Input
              value={org.billing_email || ''}
              onChange={(e) => setOrg({ ...org, billing_email: e.target.value })}
              placeholder="billing@acme.com"
            />
          </div>
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold">Security / API key rotation</h3>
            <p className="text-xs text-muted-foreground">
              Configure rotation reminders or enforcement for API keys. Enforce mode blocks traffic after the grace period.
            </p>
            <div className="grid gap-3 md:grid-cols-3 mt-2">
              <div className="space-y-1">
                <Label>Rotation mode</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={org.key_rotation_enforcement_mode || 'warn'}
                  onChange={(e) =>
                    setOrg({ ...org, key_rotation_enforcement_mode: e.target.value as Org['key_rotation_enforcement_mode'] })
                  }
                >
                  <option value="off">Off (no reminders)</option>
                  <option value="warn">Reminders only</option>
                  <option value="enforce">Enforce after grace period</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Rotation threshold (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={org.key_rotation_days ?? 90}
                  onChange={(e) => setOrg({ ...org, key_rotation_days: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Grace period (days)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  disabled={(org.key_rotation_enforcement_mode || 'warn') !== 'enforce'}
                  value={org.key_rotation_grace_days ?? 30}
                  onChange={(e) => setOrg({ ...org, key_rotation_grace_days: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Reminders: we flag stale keys and send email/webhook alerts. Enforce: after grace, stale keys are rejected.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveOrg} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && <span className="text-sm text-green-600">Saved</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Organization Settings" />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {renderForm()}
      </main>
    </div>
  )
}

