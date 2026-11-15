'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch, handleApiError, safeErrorMessage } from '@/lib/api'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'

type Prompt = {
  id: string
  title: string
  description: string
  prompt_text: string
  tags: string[]
  updated_at?: string
}

export default function PromptsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState<Prompt | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', content: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null)
    }).catch(() => setToken(null))
  }, [supabase])

  const fetchPrompts = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      if (search) params.set('search', search)
      if (tag) params.set('tag', tag)
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/prompts?${params.toString()}`, {}, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      const json = await res.json()
      setPrompts(json.items || [])
      if (json.items?.length) {
        setSelected(json.items[0])
      } else {
        setSelected(null)
      }
    } catch (err) {
      setError(safeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [token, search, tag, limit])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const tagsFromData = Array.from(new Set(prompts.flatMap(p => p.tags || []))).filter(Boolean)

  const handleCreate = async () => {
    if (!token) return
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        content: form.content,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      }
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/prompts`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      setCreating(false)
      setForm({ name: '', description: '', content: '', tags: '' })
      fetchPrompts()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!token || !selected) return
    setSaving(true)
    try {
      const payload = {
        name: selected.title,
        description: selected.description,
        content: selected.prompt_text,
        tags: selected.tags,
      }
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/prompts/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      fetchPrompts()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !selected) return
    if (!confirm('Delete this prompt?')) return
    setDeleting(true)
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/prompts/${selected.id}`, {
        method: 'DELETE',
      }, token)
      if (!res.ok) throw new Error(await handleApiError(res))
      setSelected(null)
      fetchPrompts()
    } catch (err) {
      alert(safeErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const renderList = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )
    }
    if (error) {
      return (
        <Card>
          <CardContent className="text-sm text-red-600 flex items-center gap-2">
            <span>Failed to load prompts: {error}</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-red-600 underline-offset-4" onClick={fetchPrompts}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )
    }
    if (!prompts.length) {
      return (
        <Card>
          <CardContent className="text-sm text-slate-600 p-4">
            No prompts yet. Create your first prompt and reuse it across agents and projects.
          </CardContent>
        </Card>
      )
    }
    return (
      <Card>
        <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map(p => (
              <TableRow
                key={p.id}
                className={selected?.id === p.id ? 'bg-slate-50' : ''}
                onClick={() => setSelected(p)}
              >
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.description}</TableCell>
                <TableCell className="space-x-1">
                  {(p.tags || []).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    )
  }

  const renderDetails = () => {
    if (!selected) return null
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle>{selected.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{selected.description}</p>
          </div>
          <div className="space-x-2">
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(selected.prompt_text)}>
              Copy prompt
            </Button>
            <Button size="sm" variant="outline" onClick={handleUpdate} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
            <Textarea
            value={selected.prompt_text}
            onChange={(e) => setSelected({ ...selected, prompt_text: e.target.value })}
            className="min-h-[160px]"
          />
          <Input
            value={selected.description}
            onChange={(e) => setSelected({ ...selected, description: e.target.value })}
            placeholder="Description"
          />
          <Input
            value={selected.tags?.join(', ') || ''}
            onChange={(e) => setSelected({ ...selected, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            placeholder="Tags (comma separated)"
          />
        </CardContent>
      </Card>
    )
  }

  const renderCreate = () => {
    if (!creating) return null
    return (
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>New Prompt</CardTitle>
          <Button size="icon" variant="ghost" onClick={() => setCreating(false)} aria-label="Close new prompt form">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea
            placeholder="Prompt content"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="min-h-[140px]"
          />
          <Input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Prompts" />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">Prompt Library</h1>
              <p className="text-sm text-muted-foreground">Search, reuse, and manage prompts across your org.</p>
            </div>
            <Button onClick={() => setCreating(true)}>New Prompt</Button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={fetchPrompts}
              className="w-64"
            />
            <Input
              placeholder="Filter by tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onBlur={fetchPrompts}
              className="w-48"
            />
            <Input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(100, Number(e.target.value))))}
              onBlur={fetchPrompts}
              className="w-28"
            />
          </div>
          {tagsFromData.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {tagsFromData.map((t) => (
                <Badge
                  key={t}
                  variant={tag === t ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => { setTag(t); fetchPrompts() }}
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">{renderList()}</div>
          <div className="lg:col-span-1 space-y-4">
            {renderCreate()}
            {renderDetails()}
          </div>
        </div>
      </main>
    </div>
  )
}

