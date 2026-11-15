/**
 * CANCEL SUBSCRIPTION API ROUTE (optional Stripe billing)
 * =======================================================
 * Cancels user's subscription at end of billing period.
 * 
 * User retains access until current_period_end.
 * Can be undone via reactivate endpoint before period ends.
 * 
 * Usage:
 * ```ts
 * const res = await fetch('/api/billing/cancel', { method: 'POST' })
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
    
    const response = await fetch(`${backendUrl}/billing/cancel-subscription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || 'Failed to cancel subscription' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Cancel subscription API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

