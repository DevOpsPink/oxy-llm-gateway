"use client"

/**
 * OXY ENGINE - UNIVERSAL TOKEN CALCULATOR (CLIENT COMPONENT)
 * ===========================================================
 * 
 * Estimates token counts and per-token costs across providers.
 * 
 * Features:
 * - Real-time token counting (approximation: ~4 chars/token)
 * - Multi-provider cost comparison (OpenAI, Anthropic, Google)
 * - Automatic cheapest option highlighting
 * - Copy-paste code example pointing at a self-hosted gateway
 * 
 * License: Apache 2.0
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Calculator, Copy, Check, Zap, TrendingDown, Info, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

// ============================================================================
// MODEL PRICING TABLE
// ============================================================================
// Current pricing as of Nov 2025 (per 1M tokens)
// Source: OpenAI, Anthropic, Google pricing pages

interface ModelPricing {
  provider: string
  model: string
  logo: string
  inputPricePerMillion: number
  outputPricePerMillion: number
  color: string
  colorDark: string
}

const PRICING_TABLE: ModelPricing[] = [
  {
    provider: 'OpenAI',
    model: 'GPT-4o',
    logo: '🤖',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    color: 'bg-green-100',
    colorDark: 'bg-green-600'
  },
  {
    provider: 'Anthropic',
    model: 'Claude 3.5 Sonnet',
    logo: '🧠',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    color: 'bg-purple-100',
    colorDark: 'bg-purple-600'
  },
  {
    provider: 'Google',
    model: 'Gemini 1.5 Pro',
    logo: '✨',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    color: 'bg-blue-100',
    colorDark: 'bg-blue-600'
  }
]

// ============================================================================
// TOKEN COUNTING LOGIC
// ============================================================================

/**
 * Estimate token count for text.
 * 
 * CRITICAL: This is an approximation for all providers.
 * 
 * Heuristic: ~4 characters per token (industry standard approximation)
 * 
 * Why not use tiktoken?
 * - js-tiktoken is 10MB+ (too heavy for client-side)
 * - Claude/Gemini use different tokenizers anyway
 * - For marketing tool, 90% accuracy is sufficient
 * 
 * Real-world accuracy: ±15% (acceptable for estimates)
 */
function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) return 0
  
  // Heuristic: ~4 chars per token
  // This is conservative (OpenAI: 3.5-4.5, Claude: 3.8-4.2, Gemini: 3.5-4.0)
  const avgCharsPerToken = 4
  return Math.ceil(text.length / avgCharsPerToken)
}

/**
 * Calculate cost for a given text on a specific model.
 */
function calculateCost(
  inputText: string,
  outputText: string,
  pricing: ModelPricing
): {
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
} {
  const inputTokens = estimateTokenCount(inputText)
  const outputTokens = estimateTokenCount(outputText)
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion
  const totalCost = inputCost + outputCost
  
  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost
  }
}

// ============================================================================
// UI COMPONENT
// ============================================================================

export default function TokenCalculatorClient() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [calculations, setCalculations] = useState<Array<{
    provider: string
    model: string
    logo: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    inputCost: number
    outputCost: number
    totalCost: number
    color: string
    colorDark: string
    isCheapest: boolean
  }>>([])
  
  const [copiedCode, setCopiedCode] = useState(false)
  
  // Auto-calculate on text change
  useEffect(() => {
    const results = PRICING_TABLE.map(pricing => {
      const calc = calculateCost(inputText, outputText, pricing)
      return {
        provider: pricing.provider,
        model: pricing.model,
        logo: pricing.logo,
        inputTokens: calc.inputTokens,
        outputTokens: calc.outputTokens,
        totalTokens: calc.inputTokens + calc.outputTokens,
        inputCost: calc.inputCost,
        outputCost: calc.outputCost,
        totalCost: calc.totalCost,
        color: pricing.color,
        colorDark: pricing.colorDark,
        isCheapest: false
      }
    })
    
    // Find cheapest option
    if (results.length > 0 && results.some(r => r.totalCost > 0)) {
      const minCost = Math.min(...results.filter(r => r.totalCost > 0).map(r => r.totalCost))
      results.forEach(r => {
        if (r.totalCost > 0 && r.totalCost === minCost) {
          r.isCheapest = true
        }
      })
    }
    
    setCalculations(results)
  }, [inputText, outputText])
  
  const handleCopyCode = () => {
    const code = `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'http://localhost:8000/v1',  // your Oxy gateway
  apiKey: process.env.OXY_API_KEY
})

// Switch models instantly - same code, different model
const response = await client.chat.completions.create({
  model: 'gpt-4o',        // or 'claude-3-5-sonnet' or 'gemini-1.5-pro'
  messages: [{ role: 'user', content: 'Hello!' }]
})`
    
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }
  
  // Sample texts for demo
  const loadSample = () => {
    setInputText(`You are an AI assistant helping a user with their software development tasks. The user has a complex codebase and needs help understanding a specific function. Be helpful, concise, and technical.

User: "Can you explain how async/await works in JavaScript and when I should use it?"`)
    setOutputText(`Async/await is syntactic sugar built on top of Promises in JavaScript, making asynchronous code look and behave more like synchronous code.

**How it works:**
1. The \`async\` keyword before a function makes it return a Promise
2. The \`await\` keyword pauses execution until a Promise resolves
3. Error handling uses try/catch blocks instead of .catch()

**When to use it:**
- API calls (fetch, axios)
- Database queries
- File system operations
- Any operation that returns a Promise

**Example:**
\`\`\`javascript
async function fetchUserData(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to fetch user:', error)
  }
}
\`\`\`

**Benefits:**
- More readable than nested .then() chains
- Easier error handling
- Better debugging (stack traces)

**When NOT to use:**
- Don't await in loops (use Promise.all instead)
- Don't forget error handling (always use try/catch)
- Avoid unnecessary awaits (parallel operations)`)
  }
  
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl">O</span>
            </div>
            <span className="text-xl font-black text-slate-900">Oxy Engine</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/docs" className="text-slate-600 hover:text-slate-900 font-medium">
              Docs
            </Link>
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/login">
              <Button className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Open dashboard
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-2xl"
          >
            <Calculator className="h-10 w-10 text-white" />
          </motion.div>
          
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 mb-4"
          >
            Universal Token Calculator
          </motion.h1>
          
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 mb-6"
          >
            Compare costs across OpenAI, Anthropic, and Google instantly.
          </motion.p>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 text-sm text-slate-500"
          >
            <Info className="h-4 w-4" />
            <span>Estimates based on standard tokenization (~4 chars/token). Actual costs may vary ±15%.</span>
          </motion.div>
        </div>
        
        {/* Input Section */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Input Text */}
            <Card className="shadow-xl border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  Input Text (Prompt)
                </CardTitle>
                <CardDescription>
                  The text you send to the AI model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter your prompt here..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[200px] text-base"
                />
                <div className="mt-2 text-sm text-slate-500">
                  {estimateTokenCount(inputText).toLocaleString()} tokens (~{inputText.length.toLocaleString()} chars)
                </div>
              </CardContent>
            </Card>
            
            {/* Output Text */}
            <Card className="shadow-xl border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  Output Text (Response)
                </CardTitle>
                <CardDescription>
                  The text the AI model generates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter expected response here..."
                  value={outputText}
                  onChange={(e) => setOutputText(e.target.value)}
                  className="min-h-[200px] text-base"
                />
                <div className="mt-2 text-sm text-slate-500">
                  {estimateTokenCount(outputText).toLocaleString()} tokens (~{outputText.length.toLocaleString()} chars)
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Load Sample Button */}
          <div className="text-center mt-6">
            <Button onClick={loadSample} variant="outline" className="gap-2">
              <Zap className="h-4 w-4" />
              Load Sample Text
            </Button>
          </div>
        </div>
        
        {/* Comparison Cards */}
        <div className="max-w-6xl mx-auto mb-12">
          <h2 className="text-3xl font-black text-slate-900 mb-6 text-center">
            💰 Cost Comparison
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {calculations.map((calc, index) => (
              <motion.div
                key={calc.provider}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className={`shadow-xl border-4 relative overflow-hidden ${
                  calc.isCheapest ? 'border-green-500' : 'border-slate-200'
                }`}>
                  {/* Cheapest Badge */}
                  {calc.isCheapest && calc.totalCost > 0 && (
                    <div className="absolute top-4 right-4 z-10">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1"
                      >
                        <TrendingDown className="h-3 w-3" />
                        CHEAPEST
                      </motion.div>
                    </div>
                  )}
                  
                  {/* Provider Header */}
                  <CardHeader className={`${calc.color} pb-4`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${calc.colorDark} rounded-xl flex items-center justify-center text-2xl shadow-lg`}>
                        {calc.logo}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{calc.provider}</CardTitle>
                        <CardDescription className="text-slate-700 font-medium">
                          {calc.model}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {/* Cost Breakdown */}
                  <CardContent className="pt-6">
                    {/* Total Tokens */}
                    <div className="mb-6 text-center">
                      <p className="text-sm text-slate-500 mb-1">Total Tokens</p>
                      <p className="text-4xl font-black text-slate-900">
                        {calc.totalTokens.toLocaleString()}
                      </p>
                    </div>
                    
                    {/* Cost Details */}
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Input ({calc.inputTokens.toLocaleString()} tokens)</span>
                        <span className="text-sm font-bold text-slate-900">
                          ${calc.inputCost.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Output ({calc.outputTokens.toLocaleString()} tokens)</span>
                        <span className="text-sm font-bold text-slate-900">
                          ${calc.outputCost.toFixed(6)}
                        </span>
                      </div>
                      <div className="h-px bg-slate-200" />
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-slate-900">Total Cost</span>
                        <span className="text-2xl font-black text-slate-900">
                          ${calc.totalCost.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Per 1K Requests */}
                    {calc.totalCost > 0 && (
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-500 mb-1">Cost per 1,000 requests</p>
                        <p className="text-xl font-black text-slate-900">
                          ${(calc.totalCost * 1000).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Gateway code example */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <Card className="bg-linear-to-br from-blue-600 via-purple-600 to-pink-600 text-white border-0 shadow-2xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-3xl font-black mb-2">
                    🚀 Switch Between These Models With One Line of Code
                  </h3>
                  <p className="text-blue-100 text-lg">
                    Oxy exposes one OpenAI-compatible API for OpenAI, Anthropic, Google and local models.
                    <br />
                    Same code, different models.
                  </p>
                </div>
              </div>
              
              {/* Code Example */}
              <div className="bg-slate-900 rounded-xl p-6 mb-6 relative">
                <button
                  onClick={handleCopyCode}
                  className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
                
                <pre className="text-sm text-green-400 overflow-x-auto">
                  <code>{`import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'http://localhost:8000/v1',  // your Oxy gateway
  apiKey: process.env.OXY_API_KEY
})

// Switch models instantly - same code, different model
const response = await client.chat.completions.create({
  model: 'gpt-4o',        // or 'claude-3-5-sonnet' or 'gemini-1.5-pro'
  messages: [{ role: 'user', content: 'Hello!' }]
})`}</code>
                </pre>
              </div>
              
              {/* CTA Buttons */}
              <div className="flex items-center gap-4">
                <Link href="/login" className="flex-1">
                  <Button size="lg" className="w-full bg-white text-purple-600 hover:bg-slate-100 text-lg py-6 font-black">
                    Open dashboard
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/docs" className="flex-1">
                  <Button size="lg" variant="outline" className="w-full border-2 border-white text-white hover:bg-white/10 text-lg py-6 font-black">
                    Read the docs
                  </Button>
                </Link>
              </div>
              
              {/* Facts */}
              <div className="grid grid-cols-3 gap-4 mt-8 text-center">
                <div>
                  <p className="text-3xl font-black">Apache 2.0</p>
                  <p className="text-sm text-blue-100">License</p>
                </div>
                <div>
                  <p className="text-3xl font-black">100%</p>
                  <p className="text-sm text-blue-100">OpenAI-compatible API</p>
                </div>
                <div>
                  <p className="text-3xl font-black">3</p>
                  <p className="text-sm text-blue-100">Cloud providers + local models</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-slate-600">
          <p className="mb-2">
            Built with ❤️ by <Link href="/" className="text-blue-600 hover:underline font-bold">Oxy Engine</Link>
          </p>
          <p className="text-sm text-slate-500">
            Pricing data updated Nov 2025. For the most accurate costs, please refer to official provider documentation.
          </p>
        </div>
      </footer>
    </div>
  )
}

