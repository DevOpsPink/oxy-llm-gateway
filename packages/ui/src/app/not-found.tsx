'use client'

/**
 * 404 PAGE
 * ==========================================
 * 
 * Design Philosophy:
 * - Even errors should feel premium
 * - Dark, confident, sophisticated
 * - Turn frustration into opportunity
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, ArrowRight, Cpu } from 'lucide-react'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col">
      {/* Subtle Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <nav className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center">
            <Cpu className="h-5 w-5 text-[#0A0A0B]" />
          </div>
          <span className="text-xl font-bold text-white">Oxy</span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-lg"
        >
          {/* 404 Number */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <span className="text-[12rem] sm:text-[16rem] font-display font-bold leading-none bg-linear-to-b from-white/20 to-white/5 bg-clip-text text-transparent">
              404
            </span>
          </motion.div>

          {/* Message */}
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
            Page not found
          </h1>
          <p className="text-lg text-white/50 mb-10 leading-relaxed">
            This page seems to have gone rogue.
            <br />
            Let&apos;s get you back on track.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button 
                size="lg" 
                className="h-12 px-6 bg-white text-black hover:bg-white/90 font-semibold rounded-xl"
              >
                <Home className="mr-2 h-5 w-5" />
                Back to Home
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="ghost"
                className="h-12 px-6 text-white/70 hover:text-white hover:bg-white/5 font-medium rounded-xl"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-white/30">
          <span>Self-hosted</span>
          <span>·</span>
          <span>docker compose up</span>
          <span>·</span>
          <span>Apache License 2.0</span>
        </div>
      </div>
    </div>
  )
}
