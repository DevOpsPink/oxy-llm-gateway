import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { CookieBanner } from './CookieBanner'
import { CookieBannerProvider } from '@/contexts/cookie-banner-context'

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows disclosure and dismisses when acknowledged', async () => {
    render(
      <CookieBannerProvider>
        <CookieBanner />
      </CookieBannerProvider>
    )

    // advance timer to show banner
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    const message = screen.getByText(/essential cookies/i)
    expect(message).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Got it/i })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(screen.queryByText(/essential cookies/i)).toBeNull()
    expect(localStorage.getItem('cookie_consent_acknowledged')).toBe('true')
  })
})

