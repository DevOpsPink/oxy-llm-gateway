'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Header } from '@/components/header'
import { AgentDashboard } from '@/components/dashboard/agents/agent-dashboard'
import { AgentCreationWizard } from '@/components/dashboard/agents/agent-creation-wizard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Bot } from 'lucide-react'

function AgentsPageInner() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }
      setUser(user)
      setLoading(false)
      
      // Check if we should open wizard from URL param
      if (searchParams.get('create') === 'true') {
        setShowWizard(true)
      }
    }
    init()
  }, [router, supabase, searchParams])

  const handleWizardComplete = useCallback((_agentId: string) => {
    setShowWizard(false)
    // Refresh the page to show new agent
    router.refresh()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header user={null} title="AI Agents" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} title="AI Agents" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-8">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-7 h-7 text-[#0066FF]" />
              AI Agent Control Plane
            </h1>
            <p className="text-slate-600 mt-1">
              Monitor, control, and secure your AI agents
            </p>
          </div>
          <Button
            onClick={() => setShowWizard(true)}
            className="bg-linear-to-r from-[#0066FF] to-[#00AAFF] hover:from-[#0055DD] hover:to-[#0099DD] shadow-lg shadow-[#0066FF]/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Agent
          </Button>
        </div>
        
        {/* Dashboard */}
        <AgentDashboard />
        
        {/* Creation Wizard Dialog */}
        <Dialog open={showWizard} onOpenChange={setShowWizard}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#0066FF]" />
                Create New AI Agent
              </DialogTitle>
            </DialogHeader>
            <AgentCreationWizard
              onComplete={handleWizardComplete}
              onCancel={() => setShowWizard(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AgentsPageInner />
    </Suspense>
  )
}

