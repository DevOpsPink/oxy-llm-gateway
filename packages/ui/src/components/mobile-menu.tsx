'use client'

/**
 * MOBILE NAVIGATION MENU
 * ======================
 * Hamburger menu with slide-out drawer for mobile devices
 * 
 * Features:
 * - Responsive (hidden on desktop, visible on mobile)
 * - Smooth slide-in animation
 * - Touch-friendly 48px targets
 * - Keyboard accessible
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Menu, X, Home, LayoutDashboard, Settings, Users, CreditCard, FileText, LogOut, Shield, Activity, Key, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface MobileMenuProps {
  user?: {
    email: string
    full_name?: string
  } | null
}

export function MobileMenu({ user }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('Failed to sign out')
    }
  }

  // Navigation items
  const navItems = user ? [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/requests', label: 'Requests', icon: Activity },
    { href: '/dashboard/guardrails', label: 'Guardrails', icon: Shield },
    { href: '/dashboard/intelligence', label: 'Intelligence', icon: Activity },
    { href: '/dashboard/optimizer', label: 'Optimizer', icon: Activity },
    { href: '/dashboard/attribution', label: 'Attribution', icon: CreditCard },
    { href: '/dashboard/prompts', label: 'Prompts', icon: FileText },
    { href: '/dashboard/privacy', label: 'Privacy', icon: Shield },
    { href: '/dashboard/audit', label: 'Audit Log', icon: Shield },
    { href: '/dashboard/setup', label: 'Setup', icon: Settings },
    { href: '/dashboard/api-keys', label: 'API Keys', icon: Key },
    { href: '/dashboard/playground', label: 'Playground', icon: Activity },
    { href: '/dashboard/agents', label: 'Agents', icon: Activity },
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    { href: '/dashboard/providers', label: 'Providers', icon: Settings },
    { href: '/dashboard/settings/org', label: 'Org Settings', icon: Settings },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/team', label: 'Team', icon: Users },
    { href: '/subscription', label: 'Subscription', icon: CreditCard },
    { href: '/pricing', label: 'Plan limits', icon: FileText },
  ] : [
    { href: '/', label: 'Home', icon: Home },
    { href: '/pricing', label: 'Plan limits', icon: CreditCard },
    { href: '/login', label: 'Sign In', icon: Shield },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          aria-label="Open mobile menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="h-8 w-8 bg-linear-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Oxy Engine
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* User Info */}
        {user && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user.full_name || user.email}
            </p>
            <p className="text-xs text-slate-600 truncate mt-1">
              {user.email}
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="mt-6 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-purple-100 text-purple-900 font-medium' 
                    : 'text-slate-700 hover:bg-slate-100'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign Out Button */}
        {user && (
          <div className="mt-6 pt-6 border-t">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign Out
            </Button>
          </div>
        )}

        {/* Get Started CTA (for non-authenticated users) */}
        {!user && (
          <div className="mt-6 pt-6 border-t">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                Get started →
              </Button>
            </Link>
            <p className="text-xs text-center text-slate-500 mt-3">
              Self-hosted • Apache License 2.0
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

