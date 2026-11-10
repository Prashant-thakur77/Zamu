import { randomBytes } from 'node:crypto'
import bolt11 from 'bolt11'
import { sha256Hex } from './lightning'

/**
 * A stand-in for Tando and Lightning-address servers, for local development
 * and end-to-end tests only. Invoices are real, signed BOLT11 strings, so the
 * same validation runs as in production.
 *
 * Phones steer the outcome:
 *   ...000  delivery fails
 *   ...111  delivery stays pending
 *   ...222  the invoice is for the wrong network
 *   ...333  the invoice amount does not match
 *   ...444  the invoice names a different recipient
 *   ...555  the invoice is about to expire
 *   anything else is delivered a few seconds after it is paid
 */

export const MOCK_MULTIPLIER = 10_443
const NODE_KEY = 'e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734'
const MAINNET = { bech32: 'bc', pubKeyHash: 0x00, scriptHash: 0x05, validWitnessVersions: [0] }
const TESTNET = { bech32: 'tb', pubKeyHash: 0x6f, scriptHash: 0xc4, validWitnessVersions: [0] }

interface MockInvoice {
  target: string
  createdAt: number
  kind: 'mpesa' | 'lnaddress'
}

const g = globalThis as unknown as { __zamuMock?: Map<string, MockInvoice> }
const registry = (g.__zamuMock ??= new Map())

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function makeInvoice(params: { msats: bigint; description?: string; descriptionHash?: string; expiry: number; testnet?: boolean }) {
  const paymentHash = randomBytes(32).toString('hex')
  const tags: { tagName: string; data: unknown }[] = [
    { tagName: 'payment_hash', data: paymentHash },
    { tagName: 'payment_secret', data: randomBytes(32).toString('hex') },
    { tagName: 'expire_time', data: params.expiry },
  ]
  if (params.descriptionHash) tags.push({ tagName: 'purpose_commit_hash', data: params.descriptionHash })
  else tags.push({ tagName: 'description', data: params.description ?? '' })
  const encoded = bolt11.encode({
    network: params.testnet ? TESTNET : MAINNET,
    millisatoshis: params.msats.toString(),
    timestamp: Math.floor(Date.now() / 1000),
    tags,
  } as never)
  const signed = bolt11.sign(encoded, NODE_KEY)
  return { pr: signed.paymentRequest as string, paymentHash }
}

function mpesaMetadata(phone: string): string {
  return JSON.stringify([
    ['text/plain', `Payment to Kenyan phone ${phone}@bitcoin.co.ke`],
    ['text/identifier', `${phone}@bitcoin.co.ke`],
  ])
}

async function submittedAt(paymentHash: string): Promise<Date | null> {
  const { getDb, schema } = await import('@/db')
  const { eq } = await import('drizzle-orm')
  const [row] = await getDb()
    .select({ submittedAt: schema.invoices.submittedAt })
    .from(schema.invoices)
    .where(eq(schema.invoices.paymentHash, paymentHash))
    .limit(1)
  return row?.submittedAt ?? null
}

export async function mockPayoutFetch(url: string, _init?: RequestInit): Promise<Response> {
  const u = new URL(url)

  // Tando: resolve a phone, or issue an invoice for it.
  if (u.hostname === 'bitcoin.co.ke' && u.pathname.startsWith('/.well-known/lnurlp/')) {
    const phone = u.pathname.split('/').pop() ?? ''
    if (!u.searchParams.has('amount')) {
      return json({
        callback: `https://bitcoin.co.ke/.well-known/lnurlp/${phone}`,
        maxSendable: 522_157_000,
        minSendable: 160_000,
        metadata: mpesaMetadata(phone),
        currency: { code: 'KES', name: 'Kenyan Shillings', symbol: 'KSh', decimals: 0, minSendable: 15, maxSendable: 50_000, multiplier: MOCK_MULTIPLIER },
        tag: 'payRequest',
      })
    }
    const kes = Number(u.searchParams.get('amount'))
    let msats = (BigInt(kes) * BigInt(MOCK_MULTIPLIER) * 1015n) / 1000n
    if (phone.endsWith('333')) msats = msats * 2n
    const description = phone.endsWith('444') ? 'Payment to 254799999999@bitcoin.co.ke' : `Payment to ${phone}@bitcoin.co.ke`
    const { pr, paymentHash } = makeInvoice({
      msats,
      description,
      expiry: phone.endsWith('555') ? 20 : 120,
      testnet: phone.endsWith('222'),
    })
    registry.set(paymentHash, { target: phone, createdAt: Date.now(), kind: 'mpesa' })
    return json({
      pr,
      routes: [],
      successAction: { tag: 'url', description: 'View your M-Pesa receipt', url: `https://bitcoin.co.ke/receipt/${paymentHash}` },
      converted: kes,
    })
  }

  // Tando: delivery status by payment hash.
  if (u.hostname === 'api.tando.ltd') {
    const hash = u.pathname.split('/').pop() ?? ''
    const inv = registry.get(hash)
    const paidAt = await submittedAt(hash).catch(() => null)
    if (!inv || !paidAt) return json({ success: false, error: { errorCode: 'transaction-not-found', message: 'Transaction not found' } }, 404)
    const phone = inv.target
    const age = Date.now() - paidAt.getTime()
    let status = 'processing'
    if (phone.endsWith('000') && age > 3000) status = 'failed'
    else if (!phone.endsWith('111') && age > 4000) status = 'completed'
    return json({
      success: true,
      transaction: {
        status,
        isPaid: status === 'completed',
        paymentNetworkReceipt: status === 'completed' ? `TK${hash.slice(0, 8).toUpperCase()}` : null,
        currencyAmountSent: null,
        satsAmount: null,
      },
    })
  }

  // Lightning addresses at *.example are served by the fake too.
  if (u.hostname.endsWith('.example') || u.hostname === 'wallet.example') {
    const name = u.pathname.split('/').pop() ?? ''
    if (u.pathname.startsWith('/.well-known/lnurlp/') && !u.searchParams.has('amount')) {
      return json({
        tag: 'payRequest',
        callback: `https://${u.hostname}/lnurlp/${name}/callback`,
        metadata: JSON.stringify([['text/plain', `Pay ${name}`], ['text/identifier', `${name}@${u.hostname}`]]),
        minSendable: 1000,
        maxSendable: 1_000_000_000,
      })
    }
    if (u.pathname.endsWith('/callback')) {
      const who = u.pathname.split('/').slice(-2)[0]
      const metadata = JSON.stringify([['text/plain', `Pay ${who}`], ['text/identifier', `${who}@${u.hostname}`]])
      const msats = BigInt(u.searchParams.get('amount') ?? '0')
      const { pr, paymentHash } = makeInvoice({ msats, descriptionHash: sha256Hex(metadata), expiry: 600 })
      registry.set(paymentHash, { target: `${who}@${u.hostname}`, createdAt: Date.now(), kind: 'lnaddress' })
      const verify = who.startsWith('noverify') ? undefined : `https://${u.hostname}/verify/${paymentHash}`
      return json({ pr, routes: [], verify })
    }
    if (u.pathname.startsWith('/verify/')) {
      const hash = u.pathname.split('/').pop() ?? ''
      const paidAt = await submittedAt(hash).catch(() => null)
      return json({ status: 'OK', settled: Boolean(paidAt && Date.now() - paidAt.getTime() > 3000), preimage: null, pr: '' })
    }
  }

  return json({ status: 'ERROR', reason: `Mock has no route for ${u.hostname}${u.pathname}` }, 404)
}
