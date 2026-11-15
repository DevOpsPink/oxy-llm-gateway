/**
 * STRIPE CHECKOUT API ROUTE
 * =========================
 * Proxies frontend checkout requests to the Oxy Engine backend
 * (POST /billing/create-checkout-session; optional Stripe module).
 * 
 * Supports monthly and yearly intervals. Prices are the Stripe Price IDs
 * the operator configures (STRIPE_PRICE_ID_*); none are defined here.
 * 
 * Security:
 * - Passes user JWT for authentication
 * - No sensitive credentials in frontend
 * - CORS-protected
 * 
 * Usage:
 * ```ts
 * const res = await fetch('/api/billing/checkout', {
 *   method: 'POST',
 *   body: JSON.stringify({ plan: 'starter', interval: 'year' })
 * })
 * const { checkout_url } = await res.json()
 * window.location.href = checkout_url  // Redirect to Stripe
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Get request body with interval support
    const body = await request.json()
    const { plan, interval = 'month' } = body
    
    // Validate plan
    // Keep in sync with CreateCheckoutSessionRequest in packages/engine/routes/billing.py
    if (!['starter', 'growth', 'business', 'enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be: starter, growth, business, or enterprise' },
        { status: 400 }
      )
    }
    
    // Validate interval
    if (!['month', 'year'].includes(interval)) {
      return NextResponse.json(
        { error: 'Invalid interval. Must be: month or year' },
        { status: 400 }
      )
    }
    
    // Get user session (JWT)
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }
    
    // Forward request to backend with interval
    // CRITICAL: Use INTERNAL_API_URL for server-side routes (Docker networking)
    const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    
    const response = await fetch(`${backendUrl}/billing/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan, interval })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create checkout session' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      checkout_url: data.checkout_url,
      session_id: data.session_id,
      interval: data.interval  // Return interval for frontend confirmation
    })
    
  } catch (error) {
    console.error('Checkout API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

