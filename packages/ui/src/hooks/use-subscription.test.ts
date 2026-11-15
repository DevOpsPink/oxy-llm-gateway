/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║   SUBSCRIPTION HOOK TESTS                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * Tests for packages/ui/src/hooks/use-subscription.ts
 * 
 * Strategy:
 * - Mock fetch for API calls
 * - Test all state transitions
 * - Verify toast notifications
 * - Test error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSubscription, type SubscriptionStatus } from './use-subscription'
import { toast } from 'sonner'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

// Mock window.location
const mockLocationAssign = vi.fn()
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    assign: mockLocationAssign,
  },
  writable: true,
})


// ============================================================================
// TEST DATA
// ============================================================================

const mockActiveSubscription: SubscriptionStatus = {
  has_subscription: true,
  plan_tier: 'growth',
  status: 'active',
  requests_used: 50000,
  requests_limit: 1000000,
  usage_percentage: 5.0,
  current_period_end: '2025-02-01T00:00:00Z',
  cancel_at_period_end: false,
  trial_end: null,
  billing_interval: 'month',
}

const mockTrialingSubscription: SubscriptionStatus = {
  has_subscription: true,
  plan_tier: 'starter',
  status: 'trialing',
  requests_used: 100,
  requests_limit: 100000,
  usage_percentage: 0.1,
  current_period_end: '2025-01-15T00:00:00Z',
  cancel_at_period_end: false,
  trial_end: '2025-01-15T00:00:00Z',
  billing_interval: 'month',
}

const mockNoSubscription: SubscriptionStatus = {
  has_subscription: false,
  plan_tier: null,
  status: null,
  requests_used: null,
  requests_limit: null,
  usage_percentage: null,
  current_period_end: null,
  cancel_at_period_end: false,
  trial_end: null,
  billing_interval: null,
}

const mockCanceledSubscription: SubscriptionStatus = {
  has_subscription: true,
  plan_tier: 'growth',
  status: 'active',
  requests_used: 500000,
  requests_limit: 1000000,
  usage_percentage: 50.0,
  current_period_end: '2025-02-01T00:00:00Z',
  cancel_at_period_end: true, // Will cancel at period end
  trial_end: null,
  billing_interval: 'year',
}


// ============================================================================
// TEST SETUP
// ============================================================================
let errorSpy: ReturnType<typeof vi.spyOn> | undefined
let warnSpy: ReturnType<typeof vi.spyOn> | undefined

beforeAll(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  errorSpy?.mockRestore()
  warnSpy?.mockRestore()
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})


// ============================================================================
// FETCH STATUS TESTS
// ============================================================================

describe('useSubscription - Fetch Status', () => {
  it('should fetch subscription status on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockActiveSubscription,
    })

    const { result } = renderHook(() => useSubscription())

    // Initially loading
    expect(result.current.loading).toBe(true)
    expect(result.current.subscription).toBeNull()

    // Wait for fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Verify result
    expect(result.current.subscription).toEqual(mockActiveSubscription)
    expect(result.current.error).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith('/api/billing/status')
  })

  it('should handle user without subscription', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNoSubscription,
    })

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.subscription?.has_subscription).toBe(false)
    expect(result.current.subscription?.plan_tier).toBeNull()
  })

  it('should handle trialing subscription', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTrialingSubscription,
    })

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.subscription?.status).toBe('trialing')
    expect(result.current.subscription?.trial_end).not.toBeNull()
  })

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    })

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Unauthorized')
    expect(result.current.subscription).toBeNull()
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.subscription).toBeNull()
  })
})


// ============================================================================
// CHECKOUT TESTS
// ============================================================================

describe('useSubscription - Checkout', () => {
  beforeEach(() => {
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNoSubscription,
    })
  })

  it('should create checkout session for monthly plan', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Mock checkout endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkout_url: 'https://checkout.stripe.com/session123' }),
    })

    await act(async () => {
      await result.current.checkout('growth')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'growth', interval: 'month' }),
    })

    expect(toast.loading).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Redirecting to checkout...')
    expect(window.location.href).toBe('https://checkout.stripe.com/session123')
  })

  it('should create checkout session for annual plan', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ checkout_url: 'https://checkout.stripe.com/annual' }),
    })

    await act(async () => {
      await result.current.checkout('enterprise', 'year')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'enterprise', interval: 'year' }),
    })

    expect(toast.success).toHaveBeenCalledWith('Redirecting to checkout...')
  })

  it('should handle checkout error', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Already subscribed' }),
    })

    await act(async () => {
      await result.current.checkout('starter')
    })

    expect(toast.error).toHaveBeenCalledWith('Checkout failed: Already subscribed')
  })

  it('should handle checkout network error', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await act(async () => {
      await result.current.checkout('growth')
    })

    expect(toast.error).toHaveBeenCalledWith('Checkout failed: Network error')
  })
})


// ============================================================================
// CANCEL TESTS
// ============================================================================

describe('useSubscription - Cancel', () => {
  beforeEach(() => {
    // Mock initial fetch with active subscription
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockActiveSubscription,
    })
  })

  it('should cancel subscription', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Mock cancel endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Subscription will cancel at end of billing period' }),
    })

    // Mock status refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCanceledSubscription,
    })

    await act(async () => {
      await result.current.cancel()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/cancel', {
      method: 'POST',
    })

    expect(toast.success).toHaveBeenCalledWith(
      'Subscription will cancel at end of billing period'
    )

    // Verify refresh was called
    await waitFor(() => {
      expect(result.current.subscription?.cancel_at_period_end).toBe(true)
    })
  })

  it('should handle cancel error', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No active subscription' }),
    })

    await act(async () => {
      await result.current.cancel()
    })

    expect(toast.error).toHaveBeenCalledWith('Cancellation failed: No active subscription')
  })
})


// ============================================================================
// REACTIVATE TESTS
// ============================================================================

describe('useSubscription - Reactivate', () => {
  beforeEach(() => {
    // Mock initial fetch with canceled subscription
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCanceledSubscription,
    })
  })

  it('should reactivate canceled subscription', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.subscription?.cancel_at_period_end).toBe(true)

    // Mock reactivate endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Subscription reactivated' }),
    })

    // Mock status refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockActiveSubscription,
    })

    await act(async () => {
      await result.current.reactivate()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/reactivate', {
      method: 'POST',
    })

    expect(toast.success).toHaveBeenCalledWith('Subscription reactivated')

    // Verify refresh
    await waitFor(() => {
      expect(result.current.subscription?.cancel_at_period_end).toBe(false)
    })
  })

  it('should handle reactivate error', async () => {
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Subscription is not scheduled for cancellation' }),
    })

    await act(async () => {
      await result.current.reactivate()
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Reactivation failed: Subscription is not scheduled for cancellation'
    )
  })
})


// ============================================================================
// REFRESH TESTS
// ============================================================================

describe('useSubscription - Refresh', () => {
  it('should refresh subscription status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNoSubscription,
    })

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.subscription?.has_subscription).toBe(false)

    // Mock refresh with new subscription
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockActiveSubscription,
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.subscription?.has_subscription).toBe(true)
    expect(result.current.subscription?.plan_tier).toBe('growth')
  })
})


// ============================================================================
// SUBSCRIPTION STATUS TYPE TESTS
// ============================================================================

describe('SubscriptionStatus Interface', () => {
  it('should have all required fields for active subscription', () => {
    const sub = mockActiveSubscription

    expect(sub.has_subscription).toBe(true)
    expect(sub.plan_tier).toBe('growth')
    expect(sub.status).toBe('active')
    expect(typeof sub.requests_used).toBe('number')
    expect(typeof sub.requests_limit).toBe('number')
    expect(typeof sub.usage_percentage).toBe('number')
    expect(sub.current_period_end).toBeDefined()
    expect(sub.cancel_at_period_end).toBe(false)
    expect(sub.billing_interval).toBe('month')
  })

  it('should allow null fields for no subscription', () => {
    const sub = mockNoSubscription

    expect(sub.has_subscription).toBe(false)
    expect(sub.plan_tier).toBeNull()
    expect(sub.status).toBeNull()
    expect(sub.requests_used).toBeNull()
    expect(sub.requests_limit).toBeNull()
    expect(sub.usage_percentage).toBeNull()
    expect(sub.current_period_end).toBeNull()
    expect(sub.trial_end).toBeNull()
    expect(sub.billing_interval).toBeNull()
  })

  it('should support all plan tiers', () => {
    const tiers: Array<'free' | 'starter' | 'growth' | 'business' | 'enterprise'> = [
      'free',
      'starter',
      'growth',
      'business',
      'enterprise',
    ]

    tiers.forEach(tier => {
      const sub: SubscriptionStatus = {
        ...mockActiveSubscription,
        plan_tier: tier,
      }
      expect(sub.plan_tier).toBe(tier)
    })
  })

  it('should support all status values', () => {
    const statuses: Array<'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'> = [
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
    ]

    statuses.forEach(status => {
      const sub: SubscriptionStatus = {
        ...mockActiveSubscription,
        status,
      }
      expect(sub.status).toBe(status)
    })
  })

  it('should support both billing intervals', () => {
    const intervals: Array<'month' | 'year'> = ['month', 'year']

    intervals.forEach(interval => {
      const sub: SubscriptionStatus = {
        ...mockActiveSubscription,
        billing_interval: interval,
      }
      expect(sub.billing_interval).toBe(interval)
    })
  })
})

