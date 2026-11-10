/**
 * Phone-size recordings of the real app for the film (390x844 CSS, 2x).
 *   node video/capture-phone.mjs [--only P2,P3]
 * Live site for home/demo; local app (mock wallet + mock payout partner) for the
 * signed, multi-member flow. Every take is labelled in the film accordingly.
 * Output: video/film/public/captures/<id>.webm
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'

const LIVE = 'https://zamu.prashantthakur.dev'
const LOCAL = 'http://localhost:3010'
const OUT = 'video/film/public/captures'
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null
await fs.mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const wait = (p, ms) => p.waitForTimeout(ms)

async function person(record) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-KE',
    ...(record ? { recordVideo: { dir: `${OUT}/tmp`, size: { width: 780, height: 1688 } } } : {}),
  })
  await ctx.addInitScript(() => localStorage.setItem('zamu.lang', 'en'))
  return { ctx, page: await ctx.newPage() }
}
async function save(p, id) {
  const v = p.page.video()
  await p.ctx.close()
  if (v) await fs.rename(await v.path(), `${OUT}/${id}.webm`)
  console.log('saved', id)
}
async function signIn(page, base = LOCAL) {
  await page.goto(base + '/')
  await page.getByTestId('signin').click()
  await page.getByRole('heading', { name: 'Your chamas' }).waitFor()
}
const slowType = (loc, text) => loc.pressSequentially(text, { delay: 70 })

const want = (id) => !only || only.includes(id)

if (want('P1')) {
  const a = await person(true)
  await a.page.goto(LIVE + '/', { waitUntil: 'networkidle' })
  await wait(a.page, 7000)
  await save(a, 'P1')
}

let url, code
const A = await person(false), B = await person(false), C = await person(false)
const phone = (s) => `07${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}${s}`

if (want('P2') || want('P3') || want('P4') || want('P5') || want('P6') || want('P7')) {
  // P2: Wanjiru starts the chama (recorded in its own context, then the session is reused).
  const a = await person(true)
  await signIn(a.page)
  await a.page.goto(LOCAL + '/start')
  await wait(a.page, 800)
  await slowType(a.page.getByTestId('chama-name'), 'Mama Mboga Chama')
  await a.page.getByTestId('share').fill('')
  await slowType(a.page.getByTestId('share'), '1000')
  for (let i = 0; i < 3; i++) await a.page.getByRole('button', { name: 'Fewer' }).click()
  await slowType(a.page.getByTestId('your-name'), 'Wanjiru')
  await a.page.getByTestId('phone').scrollIntoViewIfNeeded()
  await slowType(a.page.getByTestId('phone'), phone('412'))
  await wait(a.page, 400)
  await a.page.getByTestId('consent').check()
  await wait(a.page, 600)
  await a.page.getByTestId('create').click()
  await a.page.getByTestId('invite-code').waitFor()
  await wait(a.page, 2500)
  url = a.page.url()
  code = (await a.page.getByTestId('invite-code').textContent()).trim()
  const state = await a.ctx.storageState()
  await save(a, 'P2')
  await A.ctx.close()
  A.ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state })
  A.page = await A.ctx.newPage()

  // P3: Otieno joins with the code.
  const b = await person(true)
  await signIn(b.page)
  await b.page.goto(LOCAL + '/join')
  await wait(b.page, 600)
  await slowType(b.page.getByTestId('code'), code)
  await b.page.getByTestId('find').click()
  await b.page.getByTestId('your-name').waitFor()
  await wait(b.page, 1200)
  await slowType(b.page.getByTestId('your-name'), 'Otieno')
  await b.page.getByTestId('phone').scrollIntoViewIfNeeded()
  await slowType(b.page.getByTestId('phone'), phone('908'))
  await b.page.getByTestId('consent').check()
  await wait(b.page, 500)
  await b.page.getByTestId('join-submit').click()
  await b.page.getByTestId('members').waitFor()
  await wait(b.page, 1800)
  const bState = await b.ctx.storageState()
  await save(b, 'P3')
  await B.ctx.close()
  B.ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: bState })
  B.page = await B.ctx.newPage()

  // Akinyi joins off camera.
  await signIn(C.page)
  await C.page.goto(`${LOCAL}/join?code=${code}`)
  await C.page.getByTestId('your-name').fill('Akinyi')
  await C.page.getByTestId('phone').fill(phone('233'))
  await C.page.getByTestId('consent').check()
  await C.page.getByTestId('join-submit').click()
  await C.page.getByTestId('members').waitFor()

  // Wanjiru fixes the order; Otieno and Akinyi sign off camera.
  await A.page.goto(url)
  await A.page.getByTestId('lock').click()
  await A.page.getByTestId('signed-count').waitFor()
  for (const p of [B.page, C.page]) {
    await p.goto(url)
    await p.getByTestId('sign').click()
    await p.getByText(/You signed/).waitFor()
  }

  // P4: Wanjiru reads the agreement and signs; round 1 opens.
  const a4 = { ctx: await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state, recordVideo: { dir: `${OUT}/tmp`, size: { width: 780, height: 1688 } } }) }
  a4.page = await a4.ctx.newPage()
  await a4.page.goto(url)
  await a4.page.getByTestId('agreement').waitFor()
  await wait(a4.page, 1200)
  await a4.page.getByTestId('agreement').evaluate((el) => el.scrollBy({ top: 140, behavior: 'smooth' }))
  await wait(a4.page, 1600)
  await a4.page.getByTestId('sign').scrollIntoViewIfNeeded()
  await a4.page.getByTestId('sign').click()
  await a4.page.getByTestId('round-card').waitFor()
  await wait(a4.page, 3500)
  await save(a4, 'P4')

  // P5: Otieno pays his share; Sent → Delivered with the receipt.
  const b5 = { ctx: await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: bState, recordVideo: { dir: `${OUT}/tmp`, size: { width: 780, height: 1688 } } }) }
  b5.page = await b5.ctx.newPage()
  await b5.page.goto(url)
  await b5.page.getByTestId('round-card').waitFor()
  await wait(b5.page, 1500)
  await b5.page.getByTestId('open-pay').click()
  await wait(b5.page, 1400)
  await b5.page.getByTestId('pay').click()
  await b5.page.getByTestId('delivered').waitFor({ timeout: 40000 })
  await wait(b5.page, 3500)
  await save(b5, 'P5')

  // P6: Wanjiru's board: Otieno's share Paid with its receipt.
  const a6 = { ctx: await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state, recordVideo: { dir: `${OUT}/tmp`, size: { width: 780, height: 1688 } } }) }
  a6.page = await a6.ctx.newPage()
  await a6.page.goto(url)
  await a6.page.getByTestId('round-card').waitFor()
  await wait(a6.page, 1200)
  await a6.page.getByTestId('shares').scrollIntoViewIfNeeded()
  await wait(a6.page, 4000)
  await save(a6, 'P6')

  // P7: Akinyi's wallet can't confirm the outcome: Checking, never a second Pay.
  const cState = await C.ctx.storageState()
  const c7 = { ctx: await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: cState, recordVideo: { dir: `${OUT}/tmp`, size: { width: 780, height: 1688 } } }) }
  c7.page = await c7.ctx.newPage()
  await c7.page.goto(url)
  await c7.page.getByTestId('round-card').waitFor()
  await c7.page.evaluate(() => localStorage.setItem('zamu.mock.next', 'unknown'))
  await wait(c7.page, 900)
  await c7.page.getByTestId('open-pay').click()
  await wait(c7.page, 1000)
  await c7.page.getByTestId('pay').click()
  await c7.page.getByTestId('checking').waitFor()
  await wait(c7.page, 3500)
  await save(c7, 'P7')
}

if (want('P8')) {
  const d = await person(true)
  await d.page.goto(LIVE + '/demo', { waitUntil: 'networkidle' })
  await wait(d.page, 2000)
  await d.page.getByTestId('open-pay').click()
  await wait(d.page, 900)
  await d.page.getByTestId('demo-pay-btn').click()
  await d.page.getByText('Delivered to').first().waitFor({ timeout: 15000 })
  await wait(d.page, 3000)
  await save(d, 'P8')
}

await browser.close()
await fs.rm(`${OUT}/tmp`, { recursive: true, force: true })
