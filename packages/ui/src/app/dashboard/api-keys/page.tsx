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
  prefix: string
  created_at?: string
  last_used_at?: string
  rotation_required_at?: string
  status: string
}

export default function ApiKeysPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  const fetchKeys = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/api-keys`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setItems(json.items || [])
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const createKey = async () => {
    if (!token) return
    setCreating(true)
    setCreatedSecret(null)
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/api-keys`,
        { method: 'POST', body: JSON.stringify({ name: newName || 'API Key' }) },
        token
      )
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setCreatedSecret(json.secret)
      setNewName('')
      fetchKeys()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    if (!token) return
    if (!confirm('Revoke this API key?')) return
    try {
      const res = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/api-keys/${id}`,
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
            <TableRow key={k.id} onClick={() => setSelectedPrefix(k.prefix || selectedPrefix)}>
              <TableCell>{k.name}</TableCell>
              <TableCell className="font-mono text-xs">{k.prefix}</TableCell>
              <TableCell>
                <Badge variant={k.status === 'active' ? 'secondary' : 'destructive'}>
                  {k.status === 'active' ? 'Active' : 'Revoked'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{k.created_at || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{k.last_used_at || 'Never'}</TableCell>
              <TableCell>
                {k.status === 'active' && (
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
          <Dialog>
            <DialogTrigger asChild>
              <Button>Create API Key</Button>
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

