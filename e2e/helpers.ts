import { expect, test, type Browser, type Page } from '@playwright/test'

export function phone(suffix = '678'): string {
  return `07${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}${suffix}`
}

export async function user(browser: Browser, opts: { lang?: 'en' | 'sw'; init?: string } = {}): Promise<Page> {
  const desktop = test.info().project.name === 'desktop'
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1440, height: 900 }, locale: 'en-KE' } : { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: 'en-KE' },
  )
  if (opts.init) await ctx.addInitScript(opts.init)
  await ctx.addInitScript(`try { localStorage.setItem('zamu.lang', '${opts.lang ?? 'en'}') } catch {}`)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  return page
}

export async function signIn(page: Page) {
  await page.goto('/')
  await page.getByTestId('signin').click()
  await expect(page.getByRole('heading', { name: 'Your chamas' })).toBeVisible()
}

export async function createChama(page: Page, o: { name: string; share: number; size: number; you: string; phone: string }) {
  await page.goto('/start')
  await page.getByTestId('chama-name').fill(o.name)
  await page.getByTestId('share').fill(String(o.share))
  const size = page.getByTestId('size')
  while (Number(await size.textContent()) > o.size) await page.getByRole('button', { name: 'Fewer' }).click()
  while (Number(await size.textContent()) < o.size) await page.getByRole('button', { name: 'More' }).click()
  await page.getByTestId('your-name').fill(o.you)
  await page.getByTestId('phone').fill(o.phone)
  await expect(page.getByTestId('create')).toBeDisabled()
  await page.getByTestId('consent').check()
  await page.getByTestId('create').click()
  await expect(page.getByTestId('invite-code')).toBeVisible()
  return { url: page.url(), code: (await page.getByTestId('invite-code').textContent())!.trim() }
}

export async function joinChama(page: Page, code: string, you: string, ph: string) {
  await page.goto(`/join?code=${code}`)
  await page.getByTestId('your-name').fill(you)
  await page.getByTestId('phone').fill(ph)
  await page.getByTestId('consent').check()
  await page.getByTestId('join-submit').click()
  await expect(page.getByTestId('members')).toBeVisible()
}

export async function sign(page: Page, url: string) {
  await page.goto(url)
  await expect(page.getByTestId('agreement')).toContainText('Zamu chama agreement')
  await page.getByTestId('sign').click()
  await expect(page.getByText(/You signed/).or(page.getByTestId('round-card'))).toBeVisible()
}

/** Three members, order fixed, all signed: round 1 open, recipient is the creator. */
export async function activeChama(browser: Browser, recipientPhone: string) {
  const a = await user(browser)
  const b = await user(browser)
  const c = await user(browser)
  for (const p of [a, b, c]) await signIn(p)
  const { url, code } = await createChama(a, { name: `Test ${Date.now() % 10000}`, share: 100, size: 3, you: 'Wanjiru', phone: recipientPhone })
  await joinChama(b, code, 'Otieno', phone())
  await joinChama(c, code, 'Akinyi', phone())
  await a.goto(url)
  await expect(a.getByTestId('members').locator('li')).toHaveCount(3)
  await a.getByTestId('lock').click()
  await expect(a.getByTestId('signed-count')).toBeVisible()
  for (const p of [a, b, c]) await sign(p, url)
  await a.reload()
  await expect(a.getByTestId('round-card')).toBeVisible()
  return { a, b, c, url, code }
}
