/**
 * SUBSCRIPTION STATUS API ROUTE (optional Stripe billing)
 * =======================================================
 * Fetches user's current subscription status from the Oxy Engine backend.
 * 
 * Returns:
 * - Subscription plan and status
 * - Current usage vs. limits
 * - Billing period dates
 * 
 * Usage:
 * ```ts
 * const res = await fetch('/api/billing/status')
 * const { has_subscription, plan_tier, usage_percentage } = await res.json()
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get user session (JWT)
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }
    
    // Forward request to backend
    // CRITICAL: Use INTERNAL_API_URL for server-side routes (Docker networking)
    // NEXT_PUBLIC_API_URL is for client-side browser requests only
    const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    
    const response = await fetch(`${backendUrl}/billing/subscription-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch subscription status' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Subscription status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

