import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { CookieBannerProvider } from "@/contexts/cookie-banner-context";

/**
 * TYPOGRAPHY SYSTEM — PREMIUM MINIMALIST
 * ======================================
 * Inter: Clean, modern, used by Linear, Vercel, Stripe
 * JetBrains Mono: Technical monospace for code
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // ========================================================================
  // BASIC METADATA (SEO + BRAND)
  // ========================================================================
  title: {
    default: "AI Agent Control Plane & LLM Gateway | Budgets, Guardrails, DLP, Kill Switch",
    template: "%s | Oxy - AI Agent Control Plane",
  },
  description: "AI agent control plane with budgets, guardrails, DLP, and kill switch. Control spend and risk across OpenAI, Claude, Gemini, and local models.",
  keywords: [
    "AI Agent Control Plane",
    "LLM Gateway",
    "AI Budgets",
    "AI Guardrails",
    "AI DLP",
    "AI Kill Switch",
    "AI Spend Control",
    "OpenAI gateway",
    "Anthropic Claude gateway",
    "Gemini gateway",
    "Ollama gateway",
    "vLLM gateway",
    "AI cost optimization",
    "AI security",
    "AI compliance",
  ],
  authors: [{ name: "Oxy contributors", url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}` }],
  creator: "Oxy Engine",
  publisher: "Oxy Engine",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}`,
  },
  // ========================================================================
  // OPEN GRAPH
  // ========================================================================
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}`,
    siteName: "Oxy",
    title: "Oxy | AI Agent Control Plane with Budgets, Guardrails, DLP, Kill Switch",
    description: "AI agent control plane with budgets, guardrails, DLP, and kill switch. Control spend and risk across major LLM providers.",
  },
  // ========================================================================
  // TWITTER CARD
  // ========================================================================
  twitter: {
    card: "summary_large_image",
    title: "Oxy | AI Agent Control Plane",
    description: "Budgets, guardrails, DLP, and a kill switch for AI agents across OpenAI, Anthropic, Gemini, Ollama, and vLLM.",
  },
  // ========================================================================
  // ROBOTS & INDEXING
  // ========================================================================
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // ========================================================================
  // EXISTING (PRESERVED)
  // ========================================================================
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-180.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oxy",
  },
  applicationName: "Oxy",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#09090B] text-white`}
      >
        <ServiceWorkerRegistration />
        <CookieBannerProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </CookieBannerProvider>
        <Toaster
          richColors
          closeButton
          position="top-center"
          expand={true}
          toastOptions={{
            className: 'text-sm font-medium p-4',
            style: {
              border: '1px solid var(--border)',
            },
          }}
        />
      </body>
    </html>
  );
}