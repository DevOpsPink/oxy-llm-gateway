/**
 * HEADER COMPONENT
 * ================
 * 
 * Design Philosophy:
 * - Clean, confident, no gimmicks
 * - Zero emojis — professional products don't need them
 * - Subtle animations that feel premium
 * - White CTA on dark pages, dark CTA on light pages
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu, X, ArrowRight, Cpu } from 'lucide-react'
import { User } from '@supabase/supabase-js'

interface HeaderProps {
  user?: User | null
  title?: string
  children?: React.ReactNode
  marketingMode?: boolean
  activeSection?: string
  variant?: 'light' | 'dark' | 'transparent'
}

const MARKETING_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/docs', label: 'Docs' },
  { href: 'https://github.com/heyvaldemar/oxy-llm-gateway', label: 'GitHub', external: true },
]

const APP_LINKS = [
  { href: '/dashboard', label: 'Control Plane' },
  { href: '/dashboard/requests', label: 'Requests' },
  { href: '/dashboard/guardrails', label: 'Guardrails' },
  { href: '/dashboard/intelligence', label: 'Intelligence' },
  { href: '/dashboard/optimizer', label: 'Optimizer' },
  { href: '/dashboard/attribution', label: 'Attribution' },
  { href: '/dashboard/prompts', label: 'Prompts' },
  { href: '/dashboard/privacy', label: 'Privacy' },
  { href: '/dashboard/audit', label: 'Audit Log' },
  { href: '/dashboard/setup', label: 'Setup' },
  { href: '/dashboard/api-keys', label: 'API Keys' },
  { href: '/dashboard/playground', label: 'Playground' },
  { href: '/dashboard/agents', label: 'Agents' },
  { href: '/dashboard/notifications', label: 'Notifications' },
  { href: '/dashboard/providers', label: 'Providers' },
  { href: '/dashboard/settings/org', label: 'Org Settings' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
]

function NavLink({ 
  href, 
  children, 
  isHome,
  activeSection,
  variant = 'light'
}: { 
  href: string
  children: React.ReactNode
  isHome?: boolean
  activeSection?: string
  variant?: 'light' | 'dark' | 'transparent'
}) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')
  
  useEffect(() => {
    const updateHash = () => setHash(window.location.hash)
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])
  
  const isAnchor = href.includes('#')
  const anchorId = isAnchor ? href.split('#')[1] : null
  
  let isActive = false
  if (isHome) {
    isActive = pathname === '/' && (!hash || hash === '#hero' || hash === '')
  } else if (isAnchor && anchorId) {
    isActive = hash === `#${anchorId}` || activeSection === anchorId
  } else {
    isActive = pathname === href || pathname?.startsWith(`${href}/`)
  }
  
  const isDark = variant === 'dark' || variant === 'transparent'
  
  return (
    <Link 
      href={href} 
      className={`
        relative text-sm font-medium transition-all duration-200 group px-4 py-2 rounded-lg
        ${isActive 
          ? isDark ? 'text-white bg-white/10' : 'text-slate-900 bg-slate-100'
          : isDark ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }
      `}
    >
      {children}
    </Link>
  )
}

function MobileNavLink({ 
  href, 
  children, 
  onClick,
  isHome,
  activeSection
}: { 
  href: string
  children: React.ReactNode
  onClick?: () => void
  isHome?: boolean
  activeSection?: string
}) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')
  
  useEffect(() => {
    const updateHash = () => setHash(window.location.hash)
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])
  
  const isAnchor = href.includes('#')
  const anchorId = isAnchor ? href.split('#')[1] : null
  
  let isActive = false
  if (isHome) {
    isActive = pathname === '/' && (!hash || hash === '#hero' || hash === '')
  } else if (isAnchor && anchorId) {
    isActive = hash === `#${anchorId}` || activeSection === anchorId
  } else {
    isActive = pathname === href || pathname?.startsWith(`${href}/`)
  }
  
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={`
        text-lg font-medium py-3 px-4 rounded-xl transition-all duration-200
        ${isActive 
          ? 'text-slate-900 bg-slate-100' 
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }
      `}
    >
      {children}
    </Link>
  )
}

export function Header({ user, title, children, marketingMode, activeSection, variant = 'light' }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  
  const isMarketingPage = marketingMode || [
    '/',
    '/pricing',
    '/community',
    '/login',
    '/onboarding',
  ].some(path => pathname === path || pathname?.startsWith('/community'))
  
  const navLinks = isMarketingPage ? MARKETING_LINKS : APP_LINKS
  const dedupedNavLinks = useMemo(() => {
    const seen = new Set<string>()
    return navLinks.filter(link => {
      if (seen.has(link.href)) return false
      seen.add(link.href)
      return true
    })
  }, [navLinks])
  const isDark = variant === 'dark' || variant === 'transparent'
  
  return (
    <nav className={`
      sticky top-0 z-50 transition-all
      ${variant === 'transparent' 
        ? 'bg-transparent' 
        : isDark 
          ? 'bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/10' 
          : 'bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-sm'
      }
    `}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 relative">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-3 hover:opacity-80 transition-all group"
            title="Go to Home"
          >
            <div className={`
              h-10 w-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105
              ${isDark ? 'bg-white' : 'bg-[#0A0A0B]'}
            `}>
              <Cpu className={`h-5 w-5 ${isDark ? 'text-[#0A0A0B]' : 'text-white'}`} />
            </div>
            <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Oxy
            </span>
            {title && (
              <span className={`text-sm font-normal ml-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                / {title}
              </span>
            )}
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {children || dedupedNavLinks.map(link => (
              <NavLink 
                key={link.href} 
                href={link.href}
                isHome={link.href === '/'}
                activeSection={activeSection}
                variant={variant}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          
          {/* Desktop CTA */}
          {!children && (
            <div className="hidden md:flex items-center gap-4 ml-auto">
              {user ? (
                <Link href="/dashboard">
                  <Button 
                    variant={isDark ? 'outline' : 'default'}
                    className={isDark 
                      ? 'border-white/20 text-white hover:bg-white/10' 
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                    }
                  >
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link 
                    href="/login" 
                    className={`text-sm font-medium transition-colors px-3 py-2 ${
                      isDark ? 'text-white/60 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </Link>
                  <Link href="/login">
                    <Button className={`
                      h-10 px-5 font-semibold rounded-lg transition-all
                      ${isDark 
                        ? 'bg-white text-black hover:bg-white/90' 
                        : 'bg-[#0A0A0B] text-white hover:bg-slate-800'
                      }
                    `}>
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}
          
          {/* Mobile Menu */}
          <div className="md:hidden ml-auto">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`h-10 w-10 ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100'}`}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              
              <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white border-l border-slate-200">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                
                <div className="flex items-center justify-between mb-8">
                  <Link 
                    href="/" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2"
                  >
                    <div className="h-10 w-10 bg-[#0A0A0B] rounded-xl flex items-center justify-center">
                      <Cpu className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900">Oxy</span>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                    className="hover:bg-slate-100"
                    aria-label="Close menu"
                  >
                    <X className="h-6 w-6 text-slate-700" />
                  </Button>
                </div>
                
                <nav className="flex flex-col gap-1">
                  {dedupedNavLinks.map(link => (
                    <MobileNavLink 
                      key={link.href} 
                      href={link.href} 
                      onClick={() => setMobileMenuOpen(false)}
                      isHome={link.href === '/'}
                      activeSection={activeSection}
                    >
                      {link.label}
                    </MobileNavLink>
                  ))}
                  
                  <div className="pt-6 mt-4 border-t border-slate-200 flex flex-col gap-3">
                    {user ? (
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full bg-[#0A0A0B] text-white hover:bg-slate-800 text-base py-6">
                          Go to Dashboard
                        </Button>
                      </Link>
                    ) : (
                      <>
                        <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="outline" className="w-full text-base py-6">
                            Sign In
                          </Button>
                        </Link>
                        <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                          <Button className="w-full bg-[#0A0A0B] text-white hover:bg-slate-800 text-base py-6">
                            Get started
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </Button>
                        </Link>
                      </>
                    )}
                    
                    <p className="text-xs text-center text-slate-500 mt-2">
                      Self-hosted · Apache License 2.0
                    </p>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
