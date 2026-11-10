/**
 * Smoke test a deployed stage over HTTPS with real Nimiq keys:
 *   npx tsx scripts/smoke.ts https://<stage url>
 * Creates a 2-member chama, signs the agreement, fetches a live (unpaid)
 * payout invoice through the app, and checks the cron guard. Moves no money.
 */
import * as Nimiq from '@nimiq/core'
import { signedMessageHash } from '../lib/nimiq-sig'

const base = process.argv[2]?.replace(/\/$/, '')
if (!base) throw new Error('usage: smoke.ts <url>')

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
  ok ? pass++ : fail++
}

function client() {
  const kp = Nimiq.KeyPair.generate()
  const address = kp.toAddress().toUserFriendlyAddress()
  let cookie = ''
  const call = async (path: string, init: { method?: string; json?: unknown } = {}) => {
    const res = await fetch(base + path, {
      method: init.method ?? (init.json ? 'POST' : 'GET'),
      headers: { ...(init.json ? { 'content-type': 'application/json' } : {}), cookie },
      body: init.json ? JSON.stringify(init.json) : undefined,
    })
    const set = res.headers.getSetCookie()
    if (set.length) {
      const jar = new Map(cookie.split('; ').filter(Boolean).map((c) => c.split('=') as [string, string]))
      for (const c of set) {
        const [kv] = c.split(';')
        const [k, ...v] = kv.split('=')
        jar.set(k, v.join('='))
      }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }
  const sign = (m: string) => ({
    publicKey: kp.publicKey.toHex(),
    signature: Nimiq.Signature.create(kp.privateKey, kp.publicKey, signedMessageHash(m)).toHex(),
  })
  return { address, call, sign }
}

async function main() {
  const h = await fetch(`${base}/api/health`).then((r) => r.json())
  check('health: database and secrets', h.ok === true, JSON.stringify(h.checks))
  for (const p of ['/', '/demo', '/start', '/join', '/reserve', '/chamas', '/me', '/help', '/icon.svg', '/opengraph-image']) {
    const r = await fetch(base + p)
    check(`GET ${p}`, r.status === 200, String(r.status))
  }
  check('https', base.startsWith('https://'))

  const a = client()
  const b = client()
  for (const c of [a, b]) {
    const n = await c.call(`/api/auth/nonce?address=${encodeURIComponent(c.address)}`)
    const v = await c.call('/api/auth/verify', { json: { address: c.address, ...c.sign(n.body.message) } })
    check('sign in with a Nimiq signature', v.status === 200 && v.body.address === c.address)
  }
  const bad = client()
  const n = await bad.call(`/api/auth/nonce?address=${encodeURIComponent(bad.address)}`)
  const forged = await bad.call('/api/auth/verify', { json: { address: bad.address, ...a.sign(n.body.message) } })
  // A signature by A's key over B's nonce signs in as A (the key holder), never as B.
  check('a key can only sign in as its own address', forged.status !== 200 || forged.body.address === a.address, JSON.stringify(forged.body))
  const n2 = await bad.call(`/api/auth/nonce?address=${encodeURIComponent(bad.address)}`)
  const garbage = await bad.call('/api/auth/verify', { json: { address: bad.address, publicKey: a.sign('x').publicKey, signature: 'ab'.repeat(64) } })
  check('invalid signature refused', garbage.status === 401, String(garbage.status))
  void n2

  const meA = await a.call('/api/auth/me')
  check('session cookie works', meA.body.address === a.address)

  const created = await a.call('/api/chamas', {
    json: { name: 'Smoke test', shareKes: 20, frequency: 'daily', size: 2, skipUntilPaidUp: true, displayName: 'Wanjiru', payout: { method: 'mpesa', phone: '0712345678' }, consent: true },
  })
  check('create chama', created.status === 201, String(created.status))
  const preview = await b.call(`/api/chamas/preview?code=${created.body.inviteCode}`)
  check('preview by code (no phones)', preview.status === 200 && !JSON.stringify(preview.body).includes('2547'))
  const joined = await b.call('/api/chamas/join', { json: { code: created.body.inviteCode, displayName: 'Otieno', payout: { method: 'mpesa', phone: '0798765432' }, consent: true } })
  check('join chama', joined.status === 200)
  const outsider = await client().call(`/api/chamas/${created.body.id}`)
  check('outsider cannot read the board', outsider.status === 401)
  const lock = await a.call(`/api/chamas/${created.body.id}/lock`, { json: {} })
  check('lock order', lock.status === 200 && lock.body.status === 'signing')
  for (const c of [a, b]) {
    const ag = await c.call(`/api/chamas/${created.body.id}/agreement`)
    const s = await c.call(`/api/chamas/${created.body.id}/agreement`, { json: c.sign(ag.body.message) })
    check('sign agreement', s.status === 200, JSON.stringify(s.body))
  }
  const board = await b.call(`/api/chamas/${created.body.id}`)
  check('round 1 open after signatures', board.body.status === 'active' && board.body.rounds[0].status === 'open')
  check('recipient phone masked for others', board.body.members.find((m: { name: string }) => m.name === 'Wanjiru').payoutMasked === '+254 7•• ••• 678')
  const signed = await b.call(`/api/chamas/${created.body.id}/signed?address=${encodeURIComponent(a.address)}`)
  check('signed agreement re-verifies', signed.body.valid === true)

  const inv = await b.call(`/api/rounds/${board.body.rounds[0].id}/invoice`, { method: 'POST' })
  check('live payout invoice from the partner', inv.status === 200 && /^lnbc/.test(inv.body.bolt11 ?? ''), `status ${inv.status} sats ${inv.body?.sats} ${inv.body?.error ?? ''}`)
  const again = await b.call(`/api/rounds/${board.body.rounds[0].id}/invoice`, { method: 'POST' })
  check('same invoice on a second tap', again.body.id === inv.body.id && again.body.paymentHash === inv.body.paymentHash)
  const st = await b.call(`/api/invoices/${inv.body.id}/status`)
  check('status reads as not yet paid', st.status === 200 && st.body.status === 'issued', st.body.status)
  const mine = await a.call(`/api/rounds/${board.body.rounds[0].id}/invoice`, { method: 'POST' })
  check('recipient cannot pay their own turn', mine.status === 409)

  const me = await b.call('/api/me')
  check('my record lists the share I owe', me.status === 200 && me.body.owe.length >= 1 && me.body.owe[0].kes === 20, JSON.stringify(me.body.owe?.[0] ?? me.body))
  const leaveFixed = await b.call(`/api/chamas/${created.body.id}/leave`, { method: 'POST' })
  check('cannot leave once the order is fixed', leaveFixed.status === 409)

  const cronNo = await fetch(`${base}/api/cron/tick`, { method: 'POST' })
  check('cron route refuses without the secret', cronNo.status === 401)
  const v = await fetch(`${base}/api/stake/validators`).then((r) => r.json())
  check('validator list and default', Boolean(v.default?.address), v.default?.name)

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

void main()
