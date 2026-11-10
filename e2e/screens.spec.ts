import { expect, test } from '@playwright/test'
import { signIn, user } from './helpers'

test('first screen says the point and offers the three ways in', async ({ browser }) => {
  const page = await user(browser)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your chama, paid straight to M-Pesa.')
  await expect(page.getByTestId('start')).toBeVisible()
  await expect(page.getByTestId('join')).toBeVisible()
  await expect(page.getByTestId('demo')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('Swahili everywhere: toggle and host language', async ({ browser }) => {
  const page = await user(browser)
  await page.goto('/')
  await page.getByRole('button', { name: 'Kiswahili' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chama chako, pesa moja kwa moja M-Pesa.')
  await expect(page.getByTestId('start')).toHaveText('Anzisha chama')
  const host = await user(browser, { init: `localStorage.removeItem('zamu.lang'); window.nimiqPay = { language: 'sw', network: 'mainnet' }` })
  await host.addInitScript(`localStorage.removeItem('zamu.lang')`)
  await host.goto('/demo')
  await expect(host.getByText('Mfano: hakuna pesa halisi')).toBeVisible()
})

test('demo chama: pay a share and see the M-Pesa receipt, no money moved', async ({ browser }) => {
  const page = await user(browser)
  await page.goto('/demo')
  await expect(page.getByText('Demo: no real money')).toBeVisible()
  await page.getByTestId('open-pay').click()
  await page.getByTestId('demo-pay-btn').click()
  await expect(page.getByTestId('demo-pay')).toContainText('Delivered to', { timeout: 15_000 })
  await expect(page.getByTestId('demo-pay')).toContainText('M-PESA')
})

test('staked reserve: meter, default validator, stake', async ({ browser }) => {
  const page = await user(browser)
  await signIn(page)
  await page.goto('/reserve')
  await expect(page.getByTestId('reserve-meter')).toBeVisible()
  await page.getByTestId('keep-staked').check()
  await expect(page.getByText('Validator')).toBeVisible()
  await page.getByTestId('stake-amount').fill('30000')
  await page.getByTestId('stake').click()
  await expect(page.getByText(/Done/)).toBeVisible()
})

test('every screen fits 360px without sideways scroll', async ({ browser }) => {
  const page = await user(browser)
  for (const path of ['/', '/demo', '/join', '/start', '/reserve']) {
    await page.goto(path)
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, path).toBe(false)
  }
})
