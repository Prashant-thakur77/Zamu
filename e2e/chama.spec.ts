import { expect, test } from '@playwright/test'
import { activeChama, phone, signIn, user } from './helpers'

test('create, invite, join with consent, sign, pay to M-Pesa, round closes', async ({ browser }) => {
  const { a, b, c, url } = await activeChama(browser, phone('678'))
  await expect(a.getByText('Agreement signed by 3/3')).toBeVisible()
  await expect(a.getByText('Zamu yako!')).toBeVisible()

  // Otieno pays his share.
  await b.goto(url)
  await expect(b.getByTestId('share-Otieno')).toContainText('Not paid')
  await b.getByTestId('open-pay').click()
  await expect(b.getByTestId('pay-sheet')).toContainText('KSh')
  await b.getByTestId('pay').click()
  await expect(b.getByTestId('submitted')).toBeVisible()
  await expect(b.getByTestId('delivered')).toBeVisible({ timeout: 30_000 })
  await expect(b.getByTestId('delivered')).toContainText('M-PESA')
  await expect(b.getByTestId('delivered')).toContainText('View M-Pesa receipt')
  await b.getByRole('button', { name: 'Close' }).click()
  await expect(b.getByTestId('share-Otieno')).toContainText('Paid')

  // The recipient sees it land, with the receipt, without refreshing.
  await expect(a.getByTestId('share-Otieno')).toContainText('Paid', { timeout: 25_000 })

  // Akinyi pays; the round closes and the ledger records it.
  await c.goto(url)
  await c.getByTestId('open-pay').click()
  await c.getByTestId('pay').click()
  await expect(c.getByTestId('delivered')).toBeVisible({ timeout: 30_000 })
  await c.getByRole('button', { name: 'Close' }).click()
  await c.reload()
  await expect(c.getByText(/Everyone paid|Round 2/).first()).toBeVisible()
  await c.getByTestId('tab-members').click()
  await expect(c.getByText('1 on time · 0 late').first()).toBeVisible()
})

test('cancelled, outcome unknown and expired invoices', async ({ browser }) => {
  const { b, c, url } = await activeChama(browser, phone('678'))
  await b.goto(url)
  await b.getByTestId('open-pay').click()

  await b.evaluate(() => localStorage.setItem('zamu.mock.next', 'cancel'))
  await b.getByTestId('pay').click()
  await expect(b.getByText('Cancelled. Nothing was sent.')).toBeVisible()
  await expect(b.getByTestId('pay')).toBeEnabled()

  await b.evaluate(() => localStorage.setItem('zamu.mock.next', 'invalid'))
  await b.getByTestId('pay').click()
  await expect(b.getByText(/expired/)).toBeVisible()
  await expect(b.getByTestId('pay')).toBeEnabled()

  await b.evaluate(() => localStorage.setItem('zamu.mock.next', 'unknown'))
  await b.getByTestId('pay').click()
  await expect(b.getByTestId('checking')).toContainText('checking whether this went through')
  await expect(b.getByTestId('pay')).toHaveCount(0)
  // Checking resolves on its own once the partner reports delivery.
  await expect(b.getByTestId('delivered')).toBeVisible({ timeout: 30_000 })

  await c.goto(url)
  await c.getByTestId('open-pay').click()
  await c.evaluate(() => localStorage.setItem('zamu.mock.next', 'duplicate'))
  await c.getByTestId('pay').click()
  await expect(c.getByTestId('checking')).toBeVisible()
})

test('a failed payout shows the partner contact and the hash to quote', async ({ browser }) => {
  const { b, url } = await activeChama(browser, phone('000'))
  await b.goto(url)
  await b.getByTestId('open-pay').click()
  await b.getByTestId('pay').click()
  await expect(b.getByTestId('failed')).toBeVisible({ timeout: 30_000 })
  await expect(b.getByTestId('failed')).toContainText('Contact payout partner')
  await expect(b.getByTestId('failed').locator('p.font-mono')).toHaveText(/^[0-9a-f]{64}$/)
})

test('a slow payout stays Paying, never Paid', async ({ browser }) => {
  const { b, url } = await activeChama(browser, phone('111'))
  await b.goto(url)
  await b.getByTestId('open-pay').click()
  await b.getByTestId('pay').click()
  await expect(b.getByTestId('submitted')).toBeVisible()
  await b.waitForTimeout(9000)
  await expect(b.getByTestId('submitted')).toBeVisible()
  await b.getByRole('button', { name: 'Dismiss' }).click()
  await expect(b.getByTestId('share-Otieno')).toContainText('Paying')
})

test('wrong network: Lightning is blocked on testnet with a clear banner', async ({ browser }) => {
  const page = await user(browser, { init: `window.nimiqPay = { network: 'testnet', language: 'en' }` })
  await page.goto('/')
  await expect(page.getByText('Lightning payments only work on mainnet')).toBeVisible()
})

test('join form refuses a bad phone and requires consent', async ({ browser }) => {
  const a = await user(browser)
  await signIn(a)
  await a.goto('/start')
  await a.getByTestId('chama-name').fill('Bad phone')
  await a.getByTestId('your-name').fill('Wanjiru')
  await a.getByTestId('phone').fill('0812 000 000')
  await expect(a.getByTestId('create')).toBeDisabled()
  await a.getByTestId('consent').check()
  await a.getByTestId('create').click()
  await expect(a.getByText(/Safaricom M-Pesa number/)).toBeVisible()
})
