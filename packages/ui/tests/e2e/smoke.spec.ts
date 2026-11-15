/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║   🔥 SMOKE TEST SUITE - Frontend Vitality Check                              ║
 * ║   The Fortress (Infrastructure) & The Mirror (Frontend Integrity)            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * These tests verify the basic functionality of the frontend is alive:
 * - Landing page renders
 * - Login flow works
 * - Security middleware protects routes
 * 
 * Run: npm run test:e2e -- tests/e2e/smoke.spec.ts
 * 
 * CRITICAL: These are the first tests to run in CI/CD pipeline.
 * If these fail, the build should not proceed.
 */

import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if page loaded without critical errors
 */
async function expectNoServerError(page: Page) {
  // Check for common error indicators
  const bodyText = await page.locator('body').textContent()
  
  // Check for 500 errors
  expect(bodyText).not.toContain('Internal Server Error')
  expect(bodyText).not.toContain('500')
  
  // Check for white screen of death (empty body)
  expect(bodyText?.trim().length).toBeGreaterThan(10)
  
  // Check for Next.js error overlay
  const hasErrorOverlay = await page.locator('[data-nextjs-dialog]').count()
  expect(hasErrorOverlay).toBe(0)
}

// ============================================================================
// TEST SUITE 1: Landing page
// ============================================================================

test.describe('🏠 The Landing - Homepage Smoke Tests', () => {
  test('homepage loads successfully with key elements', async ({ page }) => {
    // Navigate to homepage
    const response = await page.goto('/')
    
    // Verify HTTP 200
    expect(response?.status()).toBe(200)
    
    // Verify no server errors
    await expectNoServerError(page)
    
    // Check for main heading containing brand keywords
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
    
    const headingText = await heading.textContent()
    const hasKeywords = 
      headingText?.toLowerCase().includes('oxy') ||
      headingText?.toLowerCase().includes('ai') ||
      headingText?.toLowerCase().includes('gateway') ||
      headingText?.toLowerCase().includes('api')
    
    expect(hasKeywords).toBeTruthy()
    
    // Check for navigation or header
    const hasNavigation = await page.locator('nav, header').count() > 0
    expect(hasNavigation).toBeTruthy()
    
    // Check for CTA buttons
    const ctaButtons = page.getByRole('button').or(page.getByRole('link'))
    const buttonCount = await ctaButtons.count()
    expect(buttonCount).toBeGreaterThan(0)
  })
  
  test('homepage has proper meta tags', async ({ page }) => {
    await page.goto('/')
    
    // Check title
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
    expect(title.toLowerCase()).toContain('oxy')
    
    // Check viewport meta
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
  })
  
  test('homepage loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    const loadTime = Date.now() - startTime
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)
    
    console.log(`📊 Homepage load time: ${loadTime}ms`)
  })
})

// ============================================================================
// TEST SUITE 2: Login flow
// ============================================================================

test.describe('🚪 The Gate - Login Flow Smoke Tests', () => {
  test('login page renders correctly', async ({ page }) => {
    // Navigate to login
    await page.goto('/login')
    
    await expectNoServerError(page)
    
    // Check for email input
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    await expect(emailInput.first()).toBeVisible({ timeout: 5000 })
    
    // Check for password input
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput.first()).toBeVisible()
    
    // Check for submit button
    const submitButton = page.getByRole('button', { name: /sign in|log in|continue/i })
    await expect(submitButton.first()).toBeVisible()
  })
  
  test('login shows validation for invalid email', async ({ page }) => {
    await page.goto('/login')
    
    // Find and fill email input
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await emailInput.fill('invalid-email')
    
    // Find password and fill
    const passwordInput = page.locator('input[type="password"]').first()
    await passwordInput.fill('somepassword')
    
    // Try to submit
    const submitButton = page.getByRole('button', { name: /sign in|log in|continue/i }).first()
    await submitButton.click()
    
    // Should NOT crash - page should still be functional
    await expectNoServerError(page)
    
    // Either stays on login page or shows validation
    const currentUrl = page.url()
    const stillOnLogin = currentUrl.includes('/login')
    const hasValidation = await page.locator('[class*="error"], [class*="invalid"], [role="alert"]').count() > 0
    
    // One of these should be true
    expect(stillOnLogin || hasValidation).toBeTruthy()
  })
  
  test('login with test credentials shows error (not crash)', async ({ page }) => {
    await page.goto('/login')
    
    // Fill with test credentials
    await page.locator('input[type="email"], input[name="email"]').first().fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('wrongpassword123')
    
    // Submit
    await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()
    
    // Wait for response
    await page.waitForTimeout(2000)
    
    // Should show error message, NOT white screen
    await expectNoServerError(page)
    
    // Should still be on login page or show error
    const bodyText = await page.locator('body').textContent()
    const hasErrorIndication = 
      bodyText?.toLowerCase().includes('invalid') ||
      bodyText?.toLowerCase().includes('error') ||
      bodyText?.toLowerCase().includes('incorrect') ||
      bodyText?.toLowerCase().includes('failed') ||
      page.url().includes('/login')
    
    expect(hasErrorIndication).toBeTruthy()
  })
  
  test('can navigate to login from homepage', async ({ page }) => {
    await page.goto('/')
    
    // Look for Sign In / Login button or link
    const loginLink = page.getByRole('link', { name: /sign in|log in|login/i })
      .or(page.getByRole('button', { name: /sign in|log in|login/i }))
    
    const loginLinkCount = await loginLink.count()
    
    if (loginLinkCount > 0) {
      await loginLink.first().click()
      await page.waitForURL(/\/(login|signin|auth)/, { timeout: 5000 })
      expect(page.url()).toMatch(/\/(login|signin|auth)/)
    } else {
      // Alternative: directly check login page exists
      await page.goto('/login')
      expect(page.url()).toContain('/login')
    }
  })
})

// ============================================================================
// TEST SUITE 3: Security middleware
// ============================================================================

test.describe('🔒 The Mirror Law - Security Middleware Tests', () => {
  test('protected route /onboarding redirects to login when unauthenticated', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/onboarding')
    
    // Wait for redirect
    await page.waitForTimeout(2000)
    
    // Should be redirected to login
    const currentUrl = page.url()
    const isRedirectedToAuth = 
      currentUrl.includes('/login') ||
      currentUrl.includes('/signin') ||
      currentUrl.includes('/auth')
    
    expect(isRedirectedToAuth).toBeTruthy()
    
    console.log(`🔒 Protected route test: /onboarding → ${currentUrl}`)
  })
  
  test('protected route /dashboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    
    await page.waitForTimeout(2000)
    
    const currentUrl = page.url()
    const isRedirectedToAuth = 
      currentUrl.includes('/login') ||
      currentUrl.includes('/signin') ||
      currentUrl.includes('/auth')
    
    expect(isRedirectedToAuth).toBeTruthy()
    
    console.log(`🔒 Protected route test: /dashboard → ${currentUrl}`)
  })
  
  test('protected route /settings redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    
    await page.waitForTimeout(2000)
    
    const currentUrl = page.url()
    const isRedirectedToAuth = 
      currentUrl.includes('/login') ||
      currentUrl.includes('/signin') ||
      currentUrl.includes('/auth')
    
    expect(isRedirectedToAuth).toBeTruthy()
    
    console.log(`🔒 Protected route test: /settings → ${currentUrl}`)
  })
  
  test('public routes are accessible without auth', async ({ page }) => {
    // Test plan-limits page (route kept at /pricing)
    const planLimitsResponse = await page.goto('/pricing')
    expect(planLimitsResponse?.status()).toBe(200)
    await expectNoServerError(page)
    
    // Test calculator if exists
    const calcResponse = await page.goto('/calculator')
    // May 404 but should not 500
    expect([200, 404].includes(calcResponse?.status() || 0)).toBeTruthy()
  })
})

// ============================================================================
// FINAL SUMMARY TEST
// ============================================================================

test.describe('📊 Smoke Test Summary', () => {
  test('all critical pages render without 500 errors', async ({ page }) => {
    const criticalPages = [
      '/',
      '/login',
      '/pricing',
    ]
    
    const results: { page: string; status: number; time: number }[] = []
    
    for (const pagePath of criticalPages) {
      const start = Date.now()
      const response = await page.goto(pagePath)
      const time = Date.now() - start
      const status = response?.status() || 0
      
      results.push({ page: pagePath, status, time })
      
      // Should not be 500
      expect(status).not.toBe(500)
      expect(status).not.toBe(502)
      expect(status).not.toBe(503)
    }
    
    // Log summary
    console.log('\n📊 SMOKE TEST RESULTS:')
    console.log('━'.repeat(50))
    for (const r of results) {
      const statusEmoji = r.status === 200 ? '✅' : '⚠️'
      console.log(`${statusEmoji} ${r.page.padEnd(20)} ${r.status} (${r.time}ms)`)
    }
    console.log('━'.repeat(50))
  })
})

