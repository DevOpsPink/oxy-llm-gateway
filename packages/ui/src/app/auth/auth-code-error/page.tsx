'use client'

/**
 * OXY ENGINE - AUTH ERROR PAGE (BRAND CONSISTENT EDITION)
 * ========================================================
 * 
 * Styled to match the login page with Oxy branding.
 * Honest, helpful messaging without fake progress bars.
 * 
 * Note: Magic links expire after 60 minutes (Supabase default: 3600s)
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion } from 'framer-motion'
import { Cpu, ArrowRight, Mail, RefreshCw, ShieldCheck, Clock } from 'lucide-react'

export default function AuthErrorPage() {

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4 py-12 sm:px-6 lg:px-8 relative">
      {/* Mesh gradient background - matches login page */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>
      
      {/* Logo Header - matches login page */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center relative z-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="mx-auto h-14 w-14 bg-linear-to-br from-violet-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25"
        >
          <Cpu className="h-8 w-8 text-white" />
        </motion.div>
        <h2 className="mt-6 text-center text-3xl font-display font-bold tracking-tight text-slate-900">
          Oxy Control Plane
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          AI Control Plane • Kill Switch for Agents
        </p>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="shadow-xl border-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4 pb-4">
            {/* Icon with subtle animation */}
            <motion.div
              className="flex justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="relative">
                <motion.div
                  className="absolute inset-0 bg-linear-to-r from-violet-400 to-blue-400 rounded-full blur-xl opacity-50"
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative w-16 h-16 bg-linear-to-br from-violet-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <Clock className="h-8 w-8 text-white" />
                </div>
              </div>
            </motion.div>

            <div>
              <CardTitle className="text-2xl font-display font-bold text-slate-900 mb-2">
                Link Expired
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                No worries — let's get you a fresh one!
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Helpful info box */}
            <div className="bg-violet-50 p-4 rounded-xl border border-violet-200">
              <p className="text-sm font-semibold text-violet-900 mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4 text-violet-600" />
                Why did this happen?
              </p>
              <ul className="text-sm text-violet-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-violet-500">•</span>
                  <span>Magic links expire after 1 hour for security</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500">•</span>
                  <span>Each link can only be used once</span>
                </li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            {/* Primary CTA - matches brand gradient */}
            <Link href="/login" className="w-full">
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button className="w-full bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold shadow-lg shadow-violet-500/25 rounded-xl py-6">
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Get a New Link
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Link>

            {/* Secondary CTA */}
            <Link href="https://github.com/heyvaldemar/oxy-llm-gateway/issues" className="w-full">
              <Button
                variant="outline"
                className="w-full border-slate-200 hover:border-violet-400 hover:text-violet-700 rounded-xl"
              >
                Need Help?
              </Button>
            </Link>

            {/* Agreement text - matches login page */}
            <p className="text-xs text-slate-500 text-center px-4">
              By signing in, you agree to our strict security protocols
              <br />
              and auditing standards.
            </p>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Trust Badges - matches login page */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500 relative z-10"
      >
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-4 w-4 text-violet-600" />
          Self-hosted
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-4 w-4 text-violet-600" />
          Apache License 2.0
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-4 w-4 text-violet-600" />
          No SLA: reference implementation
        </span>
      </motion.div>
    </div>
  )
}
