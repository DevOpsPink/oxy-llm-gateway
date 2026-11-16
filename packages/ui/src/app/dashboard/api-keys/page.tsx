'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

type ApiKey = {
  id: string
  name: string
  key_prefix: string
  created_at?: string
  last_used_at?: string | null
  is_active?: boolean
}

type Project = { id: string; name: string }

// Keys are managed with the dashboard session through the /management
// endpoints (the same ones the main dashboard uses). /v1/api-keys takes an
// Oxy API key, not a session, so it cannot serve this page.
// A timestamp from the API in the reader's own time zone and format.
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : null)

export default function ApiKeysPage() {
  const supabase = useMemo(() => createClient(), [])
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [items, setItems] = useState<ApiKey[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [selectedPrefix, setSelectedPrefix] = useState<string>('oxy_live_your_key_here')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  useEffect(() => {
    if (!token) return
    authenticatedFetch(`${apiUrl}/management/projects`, {}, token)
      .then(async (res) => {
        if (!res.ok) throw new Error(await handleApiError(res))
        const list: Project[] = await res.json()
        setProjects(list)
        setProjectId((current) => current || list[0]?.id || null)
        if (!list.length) setLoading(false)
      })
      .catch((err) => { setError(safeErrorMessage(err)); setLoading(false) })
  }, [token, apiUrl])

  const fetchKeys = useCallback(async () => {
    if (!token || !projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(
        `${apiUrl}/management/keys?projectId=${encodeURIComponent(projectId)}`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      setItems(await res.json())
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token, projectId, apiUrl])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const createKey = async () => {
    if (!token || !projectId) return
    setCreating(true)
    setCreatedSecret(null)
    try {
      const name = encodeURIComponent((newName || 'API Key').slice(0, 50))
      const res = await authenticatedFetch(
        `${apiUrl}/management/key?projectId=${encodeURIComponent(projectId)}&name=${name}`,
        { method: 'POST' },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setCreatedSecret(json.api_key)
      setNewName('')
      fetchKeys()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    if (!token || !projectId) return
    if (!confirm('Revoke this API key? It stops working at once.')) return
    try {
      const res = await authenticatedFetch(
        `${apiUrl}/management/key/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
        { method: 'DELETE' },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      fetchKeys()
    } catch (err) {
      alert(safeErrorMessage(err))
    }
  }

  const renderTable = () => {
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
          Unable to load keys. <button className="underline" onClick={fetchKeys}>Retry</button>
        </div>
      )
    }
    if (!items.length) {
      return (
        <div className="text-sm text-slate-600 border rounded-lg p-4 bg-slate-50">
          No keys yet. Create your first key to start using the Oxy Gateway API.
        </div>
      )
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((k) => (
            <TableRow key={k.id} onClick={() => setSelectedPrefix(k.key_prefix || selectedPrefix)}>
              <TableCell>{k.name}</TableCell>
              <TableCell className="font-mono text-xs">{k.key_prefix}</TableCell>
              <TableCell>
                <Badge variant={k.is_active !== false ? 'secondary' : 'destructive'}>
                  {k.is_active !== false ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{when(k.created_at) ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{when(k.last_used_at) ?? 'Never'}</TableCell>
              <TableCell>
                {k.is_active !== false && (
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); revokeKey(k.id) }}>
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const renderQuickstart = () => {
    const placeholder = selectedPrefix || 'oxy_live_your_key_here'
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quickstart</CardTitle>
          <p className="text-sm text-muted-foreground">Use your API key with Oxy Gateway in minutes.</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <pre className="text-xs bg-slate-100 p-3 rounded-md overflow-auto">
{`curl ${process.env.NEXT_PUBLIC_API_URL}/v1/chat/completions \\
  -H "Authorization: Bearer ${placeholder}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role":"user","content":"ping from Oxy Gateway"}]
  }'`}
              </pre>
            </TabsContent>
            <TabsContent value="python">
              <pre className="text-xs bg-slate-100 p-3 rounded-md overflow-auto">
{`import requests, os

url = "${process.env.NEXT_PUBLIC_API_URL}/v1/chat/completions"
headers = {
  "Authorization": "Bearer ${placeholder}",
  "Content-Type": "application/json",
}
payload = {
  "model": "gpt-4.1-mini",
  "messages": [{"role":"user","content":"ping from Oxy Gateway"}]
}
resp = requests.post(url, json=payload, headers=headers)
print(resp.json())`}
              </pre>
            </TabsContent>
            <TabsContent value="node">
              <pre className="text-xs bg-slate-100 p-3 rounded-md overflow-auto">
{`import fetch from "node-fetch";

const url = "${process.env.NEXT_PUBLIC_API_URL}/v1/chat/completions";
const resp = await fetch(url, {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${placeholder}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: "ping from Oxy Gateway" }],
  }),
});
console.log(await resp.json());`}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="API Keys" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">API Keys</h1>
            <p className="text-sm text-muted-foreground">Create keys for your services and agents. Keep them secret, rotate regularly.</p>
          </div>
          <div className="flex items-center gap-3">
          {projects.length > 1 && (
            <select
              aria-label="Project"
              className="border rounded-md px-2 py-1.5 text-sm bg-white"
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button disabled={!projectId}>Create API Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Name (e.g., Backend server)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <DialogFooter>
                  <Button onClick={createKey} disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
                </DialogFooter>
                {createdSecret && (
                  <div className="text-sm space-y-2">
                    <p className="font-semibold">Your new API key (shown once):</p>
                    <div className="bg-slate-100 rounded p-2 font-mono break-all text-xs">{createdSecret}</div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(createdSecret)}
                    >
                      Copy
                    </Button>
                    <p className="text-xs text-muted-foreground">You won’t be able to see this secret again. Store it securely.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Keys</CardTitle>
          </CardHeader>
          <CardContent>
            {renderTable()}
          </CardContent>
        </Card>
        {renderQuickstart()}
      </main>
    </div>
  )
}

