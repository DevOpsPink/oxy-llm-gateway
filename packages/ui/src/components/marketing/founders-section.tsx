"use client"

/**
 * 🍏 FOUNDERS — VISIBLE GLASS EFFECT
 */

import { motion } from "framer-motion"
import { Youtube, Linkedin, Globe, CheckCircle2, ArrowRight, Sparkles, Award, Users, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

interface FounderProfile {
  name: string
  role: string
  bio: string
  avatar: string
  credentials: string[]
  highlights: { icon: typeof Award; text: string }[]
  social: { linkedin?: string; youtube?: string; website?: string }
  gradient: string
}

const FOUNDERS: FounderProfile[] = [
  {
    name: "Vladimir Mikhalev",
    role: "Co-author",
    bio: "DevOps engineer. Writes about infrastructure and self-hosting at heyvaldemar.com.",
    avatar: "/founders/vladimir-mikhalev.webp",
    credentials: [],
    highlights: [],
    social: {
      linkedin: "https://www.linkedin.com/in/heyvaldemar",
      youtube: "https://www.youtube.com/channel/UCf85kQ0u1sYTTTyKVpxrlyQ?sub_confirmation=1",
      website: "https://www.heyvaldemar.com"
    },
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500"
  },
  {
    name: "Tatiana Mikhaleva",
    role: "Co-author",
    bio: "DevOps engineer behind devops.pink.",
    avatar: "/founders/tatiana-mikhaleva.webp",
    credentials: [],
    highlights: [],
    social: {
      linkedin: "https://www.linkedin.com/in/intaniaaa",
      youtube: "https://www.youtube.com/channel/UCACxfwW1C8KQY1c6nU98VVw?sub_confirmation=1",
      website: "https://devops.pink"
    },
    gradient: "from-pink-500 via-rose-500 to-orange-500"
  }
]

// 🪟 GLASS CARD — optimized for 60fps (no blur by default)
function GlassCard({ 
  children, 
  className = "", 
  hover = true,
  intensity = "medium",
  blur = false // 🚀 PERFORMANCE: blur disabled by default
}: { 
  children: React.ReactNode
  className?: string
  hover?: boolean
  intensity?: "light" | "medium" | "strong"
  blur?: boolean
}) {
  const styles = {
    light: { bg: 'rgba(255,255,255,0.65)', border: 'rgba(148,163,184,0.25)', shadow: '0 4px 24px rgba(0,0,0,0.08)' },
    medium: { bg: 'rgba(255,255,255,0.75)', border: 'rgba(148,163,184,0.3)', shadow: '0 8px 32px rgba(0,0,0,0.1)' },
    strong: { bg: 'rgba(255,255,255,0.85)', border: 'rgba(148,163,184,0.35)', shadow: '0 8px 32px rgba(0,0,0,0.12)' }
  }
  const s = styles[intensity]
  
  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.02 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{ willChange: hover ? 'transform' : undefined }}
    >
      <div 
        className="absolute inset-0 rounded-2xl" 
        style={{ 
          background: s.bg,
          ...(blur && {
            backdropFilter: 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: 'blur(16px) saturate(140%)'
          })
        }} 
      />
      <div className="absolute inset-0 rounded-2xl" style={{ border: `1px solid ${s.border}`, boxShadow: `${s.shadow}, inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 1px rgba(0,0,0,0.03)` }} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// 👤 FOUNDER CARD
function FounderCard({ founder, index }: { founder: FounderProfile; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: index * 0.15 }}
    >
      <GlassCard intensity="medium">
        <div className="relative p-7">
          {/* Avatar + Info */}
          <div className="flex items-start gap-6 mb-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className={`absolute -inset-1.5 rounded-2xl bg-linear-to-br ${founder.gradient} opacity-80 blur-sm`} />
              <div className="relative w-18 h-18 rounded-2xl overflow-hidden ring-2 ring-white shadow-xl">
                <Image src={founder.avatar} alt={founder.name} width={72} height={72} className="object-cover w-full h-full" priority />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            
            {/* Name, Role, Bio — aligned */}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{founder.name}</h3>
              <p className={`text-sm font-semibold bg-linear-to-r ${founder.gradient} bg-clip-text text-transparent mb-2`}>{founder.role}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{founder.bio}</p>
            </div>
          </div>

          {/* Credentials */}
          <div className="flex flex-wrap gap-2 mb-5">
            {founder.credentials.map((c) => (
              <GlassCard key={c} hover={false} intensity="strong">
                <span className="block px-2.5 py-1 text-xs font-medium text-slate-700">{c}</span>
              </GlassCard>
            ))}
          </div>

          {/* Proof Points — horizontal metrics */}
          <div className="flex items-center gap-6 mb-5">
            {founder.highlights.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <item.icon className={`h-4 w-4 bg-linear-to-r ${founder.gradient} bg-clip-text`} style={{ color: i === 0 ? '#8B5CF6' : i === 1 ? '#EC4899' : '#06B6D4' }} />
                <span className="text-sm font-semibold text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Social */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-200/50">
            {founder.social.linkedin && (
              <a href={founder.social.linkedin} target="_blank" rel="noopener noreferrer">
                <GlassCard intensity="strong">
                  <div className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-900 transition-colors">
                    <Linkedin className="h-4 w-4" />
                  </div>
                </GlassCard>
              </a>
            )}
            {founder.social.youtube && (
              <a href={founder.social.youtube} target="_blank" rel="noopener noreferrer">
                <GlassCard intensity="strong">
                  <div className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-900 transition-colors">
                    <Youtube className="h-4 w-4" />
                  </div>
                </GlassCard>
              </a>
            )}
            {founder.social.website && (
              <a href={founder.social.website} target="_blank" rel="noopener noreferrer">
                <GlassCard intensity="strong">
                  <div className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-900 transition-colors">
                    <Globe className="h-4 w-4" />
                  </div>
                </GlassCard>
              </a>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

export function FoundersSection() {
  return (
    <>
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <GlassCard hover={false} intensity="strong" className="inline-flex mb-4">
            <span className="flex items-center gap-2 px-4 py-2 text-slate-700 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Who built it
            </span>
          </GlassCard>
          
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            <span className="text-slate-900">Built by </span>
            <span className="bg-linear-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">two co-authors</span>
          </h2>
          
          <p className="text-lg text-slate-600">
            Oxy is open source under the Apache License 2.0.
          </p>
        </motion.div>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-8">
        {FOUNDERS.map((f, i) => <FounderCard key={f.name} founder={f} index={i} />)}
      </div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col items-center">
        <p className="text-slate-500 text-center text-sm mb-8">
          Issues and pull requests are welcome.
        </p>
        
        <Link href="https://github.com/heyvaldemar/oxy-llm-gateway" target="_blank" rel="noopener noreferrer">
          <div className="group relative">
            <div className="absolute -inset-1.5 rounded-2xl bg-linear-to-r from-violet-600 via-fuchsia-500 to-pink-500 opacity-60 blur-lg group-hover:opacity-80 transition-opacity" />
            <Button size="lg" className="relative h-14 px-10 bg-linear-to-r from-violet-600 via-fuchsia-500 to-pink-500 hover:from-violet-500 hover:via-fuchsia-400 hover:to-pink-400 text-white font-semibold rounded-xl text-lg border-0 shadow-2xl shadow-violet-500/30 transition-all">
              Star on GitHub
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </Link>
      </motion.div>
    </>
  )
}
