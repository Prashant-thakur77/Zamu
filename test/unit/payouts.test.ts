import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskPhone, normaliseKenyanPhone } from '../../lib/phone'
import { decodeInvoice, sha256Hex, validateInvoice } from '../../lib/lightning'
import { mapTandoStatus } from '../../lib/tando'
import { normaliseLightningAddress } from '../../lib/lnaddress'

// A real invoice from Tando for KES 20 to 254712345678 (never paid).
const LIVE_PR =
  'lnbc2120n1p40xtqspp579m4sl67nup2gg9fxmhcgf6f3r632ech60scrwsz4p4lv4cgchwqcqzyssp5tnts5a7ye2fn0u5wmqc4nwsg362c4nsz8vq8ww32j5ajxu5rdf6s9q7sqqqqqqqqqqqqqqqqqqqsqqqqqysgqdpu2pshjmt9de6zqar0yqer2dphxyerxdp4xcmnssrzd96xxmmfdchxxmewddjsmqz9gxqzrcrzjqwryaup9lh50kkranzgcdnn2fgvx390wgj5jd07rwr3vxeje0glcllcmepmq3fthuvqqqqlgqqqqqeqqjqjhmjzy4nn206ghctn5hl3mq20928nngfe4ng3me0znpu4r6lugwqkff9qu5e8j6q0u2vjcr2d0a2fyegqqqd50r687d0x5l3awq65aqpux6wa2'
const LIVE_META = '[["text/plain","Payment to Kenyan phone 254712345678@bitcoin.co.ke"],["text/identifier","254712345678@bitcoin.co.ke"]]'
const MULT = 10443
const inv = decodeInvoice(LIVE_PR)
const issued = new Date(inv.timestamp * 1000 + 5000)

test('normalises Kenyan numbers in every common form', () => {
  for (const input of ['0712345678', '0712 345 678', '+254712345678', '254712345678', '712345678', '+254 712-345-678']) {
    assert.equal(normaliseKenyanPhone(input), '254712345678', input)
  }
  assert.equal(normaliseKenyanPhone('0112345678'), '254112345678')
  assert.equal(normaliseKenyanPhone('0812345678'), null)
  assert.equal(normaliseKenyanPhone('07123'), null)
  assert.equal(normaliseKenyanPhone('+255712345678'), null)
  assert.equal(normaliseKenyanPhone('hello'), null)
})

test('masks a phone so only the last three digits show', () => {
  assert.equal(maskPhone('254712345678'), '+254 7•• ••• 678')
})

test('decodes a real Tando invoice', () => {
  assert.equal(inv.network, 'mainnet')
  assert.equal(inv.msats, 212000n)
  assert.equal(inv.paymentHash, 'f177587f5e9f02a420a936ef84274988f5156717d3e181ba02a86bf65708c5dc')
  assert.equal(inv.description, 'Payment to 254712345678@bitcoin.co.ke')
  assert.equal(inv.expirySeconds, 120)
})

const base = BigInt(20 * MULT)
const range = { minMsats: base, maxMsats: (base * 103n) / 100n }

test('accepts the real invoice for the right phone and amount', () => {
  const r = validateInvoice({ bolt11: LIVE_PR, metadata: LIVE_META, ...range, now: issued })
  assert.ok(r.ok)
  if (r.ok) assert.equal(r.paymentHash, inv.paymentHash)
})

test('rejects an amount mismatch', () => {
  const r = validateInvoice({ bolt11: LIVE_PR, metadata: LIVE_META, minMsats: base * 2n, maxMsats: base * 3n, now: issued })
  assert.deepEqual(r.ok, false)
})

test('rejects an invoice bound to a different recipient', () => {
  const other = LIVE_META.replaceAll('254712345678', '254799999999')
  const r = validateInvoice({ bolt11: LIVE_PR, metadata: other, ...range, now: issued })
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.reason, /not bound/)
})

test('rejects an invoice about to expire', () => {
  const late = new Date(inv.expiresAt.getTime() - 30_000)
  const r = validateInvoice({ bolt11: LIVE_PR, metadata: LIVE_META, ...range, now: late })
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.reason, /expire/)
})

test('rejects a non-mainnet invoice', async () => {
  const bolt11 = (await import('bolt11')).default
  const enc = bolt11.encode({
    network: { bech32: 'tb', pubKeyHash: 0x6f, scriptHash: 0xc4, validWitnessVersions: [0] },
    millisatoshis: '212000',
    timestamp: Math.floor(Date.now() / 1000),
    tags: [
      { tagName: 'payment_hash', data: 'a'.repeat(64) },
      { tagName: 'payment_secret', data: 'b'.repeat(64) },
      { tagName: 'description', data: 'Payment to 254712345678@bitcoin.co.ke' },
      { tagName: 'expire_time', data: 120 },
    ],
  } as never)
  const pr = bolt11.sign(enc, 'e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734').paymentRequest as string
  const r = validateInvoice({ bolt11: pr, metadata: LIVE_META, ...range })
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.reason, /testnet/)
})

test('checks description hashes against LNURL metadata', async () => {
  const bolt11 = (await import('bolt11')).default
  const meta = '[["text/plain","Pay amina"],["text/identifier","amina@wallet.example"]]'
  const enc = bolt11.encode({
    network: { bech32: 'bc', pubKeyHash: 0, scriptHash: 5, validWitnessVersions: [0] },
    millisatoshis: '5000',
    timestamp: Math.floor(Date.now() / 1000),
    tags: [
      { tagName: 'payment_hash', data: 'c'.repeat(64) },
      { tagName: 'payment_secret', data: 'd'.repeat(64) },
      { tagName: 'purpose_commit_hash', data: sha256Hex(meta) },
      { tagName: 'expire_time', data: 600 },
    ],
  } as never)
  const pr = bolt11.sign(enc, 'e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734').paymentRequest as string
  assert.ok(validateInvoice({ bolt11: pr, metadata: meta, minMsats: 5000n, maxMsats: 5000n }).ok)
  assert.equal(validateInvoice({ bolt11: pr, metadata: meta + ' ', minMsats: 5000n, maxMsats: 5000n }).ok, false)
})

test('maps Tando delivery statuses', () => {
  assert.deepEqual(
    mapTandoStatus({ success: true, transaction: { status: 'completed', isPaid: true, paymentNetworkReceipt: 'TKA1B2C3', currencyAmountSent: 1000, satsAmount: 10524 } }),
    { state: 'delivered', receiptCode: 'TKA1B2C3', kesSent: 1000, sats: 10524 },
  )
  assert.equal(mapTandoStatus({ success: true, transaction: { status: 'completed', isPaid: false } }).state, 'pending')
  for (const s of ['failed', 'cancelled', 'canceled', 'expired', 'error', 'refunded']) {
    assert.equal(mapTandoStatus({ success: true, transaction: { status: s } }).state, 'failed', s)
  }
  assert.equal(mapTandoStatus({ success: true, transaction: { status: 'processing' } }).state, 'pending')
  assert.equal(mapTandoStatus({ success: false, error: { errorCode: 'transaction-not-found' } }).state, 'pending')
  assert.equal(mapTandoStatus(null).state, 'pending')
})

test('normalises Lightning addresses', () => {
  assert.equal(normaliseLightningAddress(' Amina@Wallet.Example '), 'amina@wallet.example')
  assert.equal(normaliseLightningAddress('amina'), null)
  assert.equal(normaliseLightningAddress('amina@localhost'), null)
})

test('ignores non-numeric amounts from the partner', () => {
  const r = mapTandoStatus({ success: true, transaction: { status: 'completed', isPaid: true, currencyAmountSent: 'n/a', satsAmount: '10,524' } })
  assert.deepEqual(r, { state: 'delivered', receiptCode: null, kesSent: null, sats: 10524 })
})
