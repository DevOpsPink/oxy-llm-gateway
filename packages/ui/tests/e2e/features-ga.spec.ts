import { test, expect } from '@playwright/test'

test.describe('GA feature surfaces - landing/UI', () => {
  test('agent templates section is visible and docs page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Agent Templates')).toBeVisible()
    await expect(page.getByText('9 agent types, ready to deploy', { exact: false })).toBeVisible()

    // Docs page exists for templates
    const docsPage = await page.goto('/docs/features/agent-templates')
    expect(docsPage?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /agent templates/i })).toBeVisible()
  })

  test('security score is displayed with heuristic copy', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Security Score')).toBeVisible()
    await expect(page.getByText(/Heuristic A-F grade/i)).toBeVisible()
    await expect(page.getByText(/Not a certification/i)).toBeVisible()
  })

  test('cookie banner discloses essential cookies and can be dismissed', async ({ page }) => {
    await page.goto('about:blank')
    await page.evaluate(() => {
      localStorage.removeItem('cookie_consent_acknowledged')
      localStorage.removeItem('cookie_consent_timestamp')
    })

    await page.goto('/')
    await expect(page.getByText(/We use essential cookies/i)).toBeVisible({ timeout: 4000 })

    await page.getByRole('button', { name: /Got it/i }).click()
    await expect(page.getByText(/We use essential cookies/i)).toBeHidden({ timeout: 2000 })
  })
})

