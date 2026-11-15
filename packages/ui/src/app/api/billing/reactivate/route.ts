/**
 * REACTIVATE SUBSCRIPTION API ROUTE (optional Stripe billing)
 * ===========================================================
 * Reactivates a subscription that was scheduled for cancellation.
 * 
 * Only works if subscription hasn't ended yet (cancel_at_period_end = true).
 * 
 * Usage:
 * ```ts
 * const res = await fetch('/api/billing/reactivate', { method: 'POST' })
 * const { status, message } = await res.json()
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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
    const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    
    const response = await fetch(`${backendUrl}/billing/reactivate-subscription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to reactivate subscription' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Reactivate subscription API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

