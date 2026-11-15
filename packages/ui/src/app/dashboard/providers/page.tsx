'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type ProviderConfig = {
  enabled: boolean
  configured_via_env?: boolean
}

type ConfigResponse = {
  openai: ProviderConfig
  anthropic: ProviderConfig
  google: ProviderConfig
  local: ProviderConfig
}

const providerOrder: Array<keyof ConfigResponse> = ['openai', 'anthropic', 'google', 'local']

const providerMeta: Record<string, { title: string; description: string; envHint?: string; doc?: string }> = {
  openai: { title: 'OpenAI', description: 'GPT-4.1 / GPT-4o / GPT-4.1-mini via OpenAI.', envHint: 'OPENAI_API_KEY' },
  anthropic: { title: 'Anthropic', description: 'Claude models via Anthropic.', envHint: 'ANTHROPIC_API_KEY' },
  google: { title: 'Google', description: 'Gemini models via Google AI Studio.', envHint: 'GOOGLE_API_KEY' },
  local: {
    title: 'Local / self-hosted',
    description: 'Local models (e.g., Ollama/vLLM/OpenAI-compatible HTTP).',
    envHint: 'OLLAMA_BASE_URL / VLLM_BASE_URL / LOCAL_HTTP_BASE_URL',
    doc: '/docs/providers/local-llm',
  },
}

export default function ProvidersPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token || null)).catch(() => setToken(null))
  }, [supabase])

  const fetchConfig = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/providers/config`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = (await res.json()) as ConfigResponse
      setConfig(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const save = async () => {
    if (!token || !config) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/providers/config`,
        { method: 'POST', body: JSON.stringify(config) },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = (await res.json()) as ConfigResponse
      setConfig(json)
      setSaved(true)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const renderRows = () => {
    if (!config) return null
    return providerOrder.map((key) => {
      const meta = providerMeta[key]
      const row = config[key]
      const env = row.configured_via_env
      const showWarning = row.enabled && env === false
      return (
        <div key={key} className="flex items-start justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{meta.title}</span>
              {env ? <Badge variant="secondary">Configured via env</Badge> : <Badge variant="outline">Env not detected</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
            {meta.doc && (
              <a className="text-xs text-violet-600 hover:text-violet-700 underline" href={meta.doc} target="_blank" rel="noreferrer">
                View setup docs
              </a>
            )}
            {showWarning && (
              <p className="text-xs text-amber-600">
                Enabled, but no environment key detected ({meta.envHint}). Ensure the server has the right credentials.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={row.enabled} onCheckedChange={(checked) => setConfig({ ...config, [key]: { ...row, enabled: checked } })} />
          </div>
        </div>
      )
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Providers" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Providers</h2>
          <p className="text-sm text-muted-foreground">
            Enable or disable AI providers for this workspace. Local providers (Ollama, vLLM, OpenAI-compatible) run on your infra; performance/quality depend on your deployment. See docs/providers/local-llm.
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <span>{error}</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-red-700 underline-offset-4" onClick={fetchConfig}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Providers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">{renderRows()}</CardContent>
            </Card>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {saved && <span className="text-sm text-green-600">Saved</span>}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

