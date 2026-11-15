'use client'

/**
 * 📚 DOCUMENTATION LAYOUT
 * =======================
 * 
 * Design: Matches landing page (Aurora + Glass Cards)
 * Layout: clean, scannable sidebar navigation.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { 
  Cpu, ChevronRight, Menu, X,
  Shield, Eye, Lock, Target, Database, Lightbulb, Tags, FileDown,
  Brain, BookOpen, Zap, RefreshCw, Users, Globe, Bell, Webhook,
  Gift, Server, Bot, Link2, UserPlus
} from 'lucide-react'

// ===========================================================================
// 📚 DOCUMENTATION NAVIGATION STRUCTURE
// ===========================================================================
const docsNavigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Quick Start', href: '/docs', icon: Zap },
      { title: 'Installation', href: '/docs/installation', icon: Cpu },
    ]
  },
  {
    title: 'Core Features',
    items: [
      { title: 'Kill Switch', href: '/docs/features/kill-switch', icon: Shield },
      { title: 'DLP Scanning', href: '/docs/features/dlp-scanning', icon: Eye },
      { title: 'Block Actions', href: '/docs/features/block-actions', icon: Lock },
      { title: 'Guardrails', href: '/docs/features/guardrails', icon: Target },
      { title: 'AI Insights', href: '/docs/features/ai-insights', icon: Brain },
    ]
  },
  {
    title: 'Agent Management',
    items: [
      { title: 'Agent Templates', href: '/docs/features/agent-templates', icon: Bot },
      { title: 'Prompt Library', href: '/docs/features/prompt-library', icon: BookOpen },
      { title: 'Team Management', href: '/docs/features/team-management', icon: UserPlus },
    ]
  },
  {
    title: 'Cost Management',
    items: [
      { title: 'Response Caching', href: '/docs/features/response-caching', icon: Database },
      { title: 'Local Models', href: '/docs/features/local-models', icon: Server },
      { title: 'AI Cost Optimizer', href: '/docs/features/cost-optimizer', icon: Lightbulb },
      { title: 'Cost Attribution', href: '/docs/features/cost-attribution', icon: Tags },
      { title: 'Budgets & Alerts', href: '/docs/features/budgets', icon: Bell },
      { title: 'Referral Credits', href: '/docs/features/referral-credits', icon: Gift },
    ]
  },
  {
    title: 'Security & Operations',
    items: [
      { title: 'SSO / SAML', href: '/docs/features/sso', icon: Users },
      { title: 'Key Rotation', href: '/docs/features/key-rotation', icon: RefreshCw },
      { title: 'CSV Export', href: '/docs/features/csv-export', icon: FileDown },
      { title: 'Geo-blocking', href: '/docs/features/geo-blocking', icon: Globe },
      { title: 'Webhooks', href: '/docs/features/webhooks', icon: Webhook },
      { title: 'MCP Monitoring', href: '/docs/features/mcp-monitoring', icon: Cpu },
    ]
  },
  {
    title: 'Integrations',
    items: [
      { title: 'HubSpot CRM', href: '/docs/integrations/hubspot', icon: Link2 },
    ]
  },
]

// ===========================================================================
// 🎨 AURORA BACKGROUND (Same as landing)
// ===========================================================================
function DocsAurora() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ willChange: 'transform' }}>
      <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-white to-slate-100/95" />
      <div
        className="absolute top-[5%] -left-[15%] w-[60vw] h-[60vw] rounded-full animate-aurora-slow"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0.15) 50%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateZ(0)',
        }}
      />
      <div
        className="absolute top-[10%] -right-[10%] w-[55vw] h-[55vw] rounded-full animate-aurora-medium"
        style={{
          background: 'radial-gradient(circle, rgba(236,72,153,0.35) 0%, rgba(244,114,182,0.1) 50%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translateZ(0)',
        }}
      />
    </div>
  )
}

// ===========================================================================
// 🃏 GLASS SIDEBAR
// ===========================================================================
function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 z-50
        bg-white/90 backdrop-blur-xl border-r border-slate-200/50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:top-16
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/50 lg:hidden">
          <span className="font-semibold text-slate-900">Documentation</span>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 overflow-y-auto h-[calc(100%-64px)] lg:h-[calc(100vh-64px)]">
          {docsNavigation.map((section) => (
            <div key={section.title} className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                          transition-all duration-200
                          ${isActive 
                            ? 'bg-linear-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-700 border border-violet-200/50' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }
                        `}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-violet-600' : 'text-slate-400'}`} />
                        {item.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

// ===========================================================================
// 📄 MAIN LAYOUT
// ===========================================================================
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  return (
    <div className="min-h-screen relative">
      <DocsAurora />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/50">
        <div className="flex items-center h-16 px-4 lg:px-6">
          {/* Mobile menu button */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg lg:hidden mr-2"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-linear-to-br from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Cpu className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900">Oxy</span>
          </Link>
          
          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 ml-6 text-sm">
            <Link href="/docs" className="text-slate-500 hover:text-slate-700">Docs</Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <span className="text-slate-900 font-medium">Documentation</span>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-4 ml-auto">
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 font-medium hidden sm:block">
              ← Back to Home
            </Link>
            <Link href="/login">
              <button className="px-4 py-2 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-medium rounded-xl transition-all">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </header>
      
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main content */}
      <main className="relative z-10 pt-16 lg:pl-72">
        <div className="max-w-4xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}

