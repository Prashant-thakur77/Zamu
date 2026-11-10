import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3010)

/**
 * End-to-end tests at 360x780 against a dev server running with the mock
 * Nimiq wallet and the mock payout partner (see .env.local / .env.example).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 780 },
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${port}`,
        url: `http://localhost:${port}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { MOCK_PAYOUTS: '1', NEXT_PUBLIC_MOCK_NIMIQ: '1' },
      },
})
