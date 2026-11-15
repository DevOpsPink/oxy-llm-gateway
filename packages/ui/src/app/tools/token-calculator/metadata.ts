import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Token Calculator | Compare OpenAI, Claude & Gemini Pricing | Oxy Engine',
  description: 'Universal token calculator to compare costs across OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, and Google Gemini 1.5 Pro. Instant estimates with real-time calculation.',
  keywords: [
    'AI token calculator',
    'OpenAI pricing calculator',
    'Claude token calculator',
    'Gemini pricing calculator',
    'LLM cost calculator',
    'GPT-4o pricing',
    'Claude 3.5 Sonnet cost',
    'Gemini 1.5 Pro pricing',
    'AI cost comparison',
    'token counting tool'
  ],
  authors: [{ name: 'Oxy Engine' }],
  openGraph: {
    title: 'Universal AI Token Calculator - Compare OpenAI, Claude & Gemini',
    description: 'Calculate and compare AI costs across multiple providers instantly. Switch between models with one line of code.',
    type: 'website',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/tools/token-calculator`,
    siteName: 'Oxy Engine',
    images: [
      {
        url: '/og-token-calculator.png',
        width: 1200,
        height: 630,
        alt: 'Universal Token Calculator by Oxy Engine'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Universal AI Token Calculator',
    description: 'Compare costs across OpenAI, Claude & Gemini instantly',
    images: ['/og-token-calculator.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/tools/token-calculator`
  }
}

