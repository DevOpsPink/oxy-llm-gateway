import { Metadata } from 'next'
import LandingClient from '@/components/landing/LandingClient'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: "Oxy — Self-hosted LLM Gateway (Apache 2.0)",
  description: "Open-source LLM gateway with budgets, DLP, kill switch, and audit logs. Runs end-to-end on a single docker compose up across OpenAI, Anthropic, Gemini, Ollama, and vLLM.",
  keywords: [
    "self-hosted LLM gateway",
    "open source LLM gateway",
    "LLM proxy",
    "AI gateway",
    "LLM budgets",
    "AI guardrails",
    "AI DLP",
    "AI kill switch",
    "OpenAI gateway",
    "Anthropic gateway",
    "Gemini gateway",
    "Ollama gateway",
    "vLLM gateway",
    "Apache 2.0",
  ],
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/`,
  },
  openGraph: {
    title: "Oxy — Self-hosted LLM Gateway (Apache 2.0)",
    description: "Open-source LLM gateway with budgets, DLP, kill switch, audit logs, and cost analytics. Self-hosted via docker compose; no cloud accounts required.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/`,
    siteName: "Oxy",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Oxy — Self-hosted LLM Gateway" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oxy — Self-hosted LLM Gateway",
    description: "Open-source LLM gateway with budgets, DLP, kill switch, and audit logs. Runs locally on docker compose.",
    images: ["/og.png"],
  },
}

export default function Page() {
  return <LandingClient />
}
