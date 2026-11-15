/**
 * WCAG 2.1 AA ACCESSIBILITY TESTING CONFIG
 * =========================================
 * Automated accessibility testing with axe-core
 * 
 * Standards:
 * - WCAG 2.1 Level AA
 * - Section 508
 * - EN 301 549
 * 
 * Goal: keep the UI usable with assistive technology
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/accessibility',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/accessibility-report' }],
    ['json', { outputFile: 'test-results/accessibility-results.json' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'accessibility-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'accessibility-firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'accessibility-webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})

