'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

type PlaygroundResponse = any

const MODELS = [
  'gpt-4.1-mini',
  'gpt-4.1',
  'claude-3.5-sonnet',
  'gemini-1.5-pro',
]

export default function PlaygroundPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [model, setModel] = useState(MODELS[0])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<PlaygroundResponse | null>(null)
  const [rawOpen, setRawOpen] = useState(false)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const runRequest = useCallback(async () => {
    if (!token || !userPrompt.trim()) return
    setLoading(true)
    setError(null)
    setLatencyMs(null)
    const start = Date.now()
    try {
      const messages = []
      if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt.trim() })
      }
      messages.push({ role: 'user', content: userPrompt.trim() })
      const payload: Record<string, any> = {
        model,
        messages,
        temperature,
      }
      const mt = parseInt(maxTokens, 10)
      if (!isNaN(mt) && mt > 0) {
        payload.max_tokens = mt
      }

      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/chat/completions`,
        { method: 'POST', body: JSON.stringify(payload) },
        token
      )
      const elapsed = Date.now() - start
      setLatencyMs(elapsed)
      if (!res.ok) {
        const msg = await handleApiError(res)
        throw new Error(msg)
      }
      const json = await res.json()
      setResponse(json)
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token, userPrompt, systemPrompt, model, temperature, maxTokens])

  const assistantText = response?.choices?.[0]?.message?.content || ''
  const usage = response?.usage || {}

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Playground" />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Playground</h1>
          <p className="text-sm text-muted-foreground">
            Try `/v1/chat/completions` interactively with your API key. See responses, tokens, and latency.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Request Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>System prompt (optional)</Label>
                <Textarea
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                />
              </div>
              <div className="space-y-2">
                <Label>User prompt</Label>
                <Textarea
                  rows={6}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Ask something..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} id="advanced" />
                <Label htmlFor="advanced">Advanced options</Label>
              </div>
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={temperature}
                      onChange={(e) => setTemperature(Math.max(0, Math.min(1, Number(e.target.value))))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max tokens (optional)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <Button onClick={runRequest} disabled={loading || !userPrompt.trim()}>
                {loading ? 'Running…' : 'Run'}
              </Button>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result & Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!response && !loading && !error && (
                <p className="text-sm text-muted-foreground">No requests yet. Build a prompt and click Run.</p>
              )}
              {loading && (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}
              {response && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{response.model || model}</Badge>
                    {latencyMs !== null && <Badge variant="secondary">Latency: {latencyMs} ms</Badge>}
                  </div>
                  <div className="border rounded p-3 bg-white">
                    <div className="font-semibold mb-2">Assistant reply</div>
                    <div className="text-sm whitespace-pre-wrap">{assistantText || '—'}</div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(assistantText || '')}
                      >
                        Copy response text
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(response, null, 2))}
                      >
                        Copy raw JSON
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex gap-3 flex-wrap">
                      {typeof usage.prompt_tokens === 'number' && <span>Prompt tokens: {usage.prompt_tokens}</span>}
                      {typeof usage.completion_tokens === 'number' && <span>Completion tokens: {usage.completion_tokens}</span>}
                      {typeof usage.total_tokens === 'number' && <span>Total tokens: {usage.total_tokens}</span>}
                    </div>
                    {response.cost_usd && <div>Cost: ${response.cost_usd}</div>}
                  </div>
                  <div>
                    <Button variant="link" className="px-0" onClick={() => router.push('/dashboard/requests')}>
                      Open Requests
                    </Button>
                  </div>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => setRawOpen(!rawOpen)}>
                      {rawOpen ? 'Hide raw JSON' : 'View raw JSON'}
                    </Button>
                    {rawOpen && (
                      <pre className="mt-2 p-2 bg-slate-100 rounded text-xs overflow-auto">
                        {JSON.stringify(response, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

