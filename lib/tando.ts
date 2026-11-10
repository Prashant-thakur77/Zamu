import { normaliseKenyanPhone } from './phone'
import { validateInvoice, metadataIdentifier } from './lightning'
import { payoutFetch } from './payout-fetch'

/**
 * Tando: Lightning in, M-Pesa out.
 *
 * Everything here uses Tando's public endpoints. There is no API key: the
 * LNURL-pay address `<phone>@bitcoin.co.ke` is the integration, and the
 * payment-hash status endpoint tells us when the shillings landed.
 */

export const TANDO_LNURL_BASE = 'https://bitcoin.co.ke/.well-known/lnurlp'
export const TANDO_STATUS_BASE = 'https://api.tando.ltd/v1/transactions/btcpay/payment-hash'

export const KES_MIN = 15
export const KES_MAX = 50_000

/** Accept invoices up to this far above KES × multiplier (Tando's spread). */
export const MAX_SPREAD = 0.03

export class PayoutError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message)
  }
}

export interface TandoPayRequest {
  callback: string
  metadata: string
  minSendable: number
  maxSendable: number
  currency: { code: string; minSendable: number; maxSendable: number; multiplier: number }
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await payoutFetch()(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new PayoutError('Could not reach the payout partner. Try again in a moment.', true)
  }
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new PayoutError(`The payout partner returned an unexpected reply (${res.status}).`, true)
  }
  if (!res.ok) {
    const reason = (body as { reason?: string; message?: string })?.reason ?? (body as { message?: string })?.message
    throw new PayoutError(reason || `The payout partner refused the request (${res.status}).`, res.status >= 500)
  }
  if ((body as { status?: string })?.status === 'ERROR') {
    throw new PayoutError((body as { reason?: string }).reason || 'The payout partner refused the request.')
  }
  return body as T
}

export async function resolveMpesa(phone: string): Promise<TandoPayRequest> {
  const n = normaliseKenyanPhone(phone)
  if (!n) throw new PayoutError('That is not a Kenyan M-Pesa number.')
  const req = await getJson<TandoPayRequest>(`${TANDO_LNURL_BASE}/${n}`)
  if (!req.callback || !req.metadata || !req.currency?.multiplier) {
    throw new PayoutError('The payout partner did not return a usable payment request.', true)
  }
  if (req.currency.code !== 'KES') throw new PayoutError('The payout partner is not quoting in KES.')
  return req
}

/** msats per KES at Tando's current published rate. */
export async function currentMultiplier(): Promise<number> {
  // Any valid phone returns the same rate; the number is never charged.
  const req = await resolveMpesa('254700000000')
  return req.currency.multiplier
}

export interface MpesaInvoice {
  bolt11: string
  paymentHash: string
  msats: bigint
  sats: number
  expiresAt: Date
  receiptUrl: string | null
  multiplier: number
  metadata: string
}

export async function requestMpesaInvoice(phone: string, kes: number): Promise<MpesaInvoice> {
  if (!Number.isInteger(kes) || kes < KES_MIN || kes > KES_MAX) {
    throw new PayoutError(`Each share must be between KSh ${KES_MIN} and KSh ${KES_MAX.toLocaleString('en-US')}.`)
  }
  const req = await resolveMpesa(phone)
  if (kes < req.currency.minSendable || kes > req.currency.maxSendable) {
    throw new PayoutError(
      `The payout partner accepts KSh ${req.currency.minSendable}–${req.currency.maxSendable.toLocaleString('en-US')} right now.`,
    )
  }

  const sep = req.callback.includes('?') ? '&' : '?'
  const res = await getJson<{ pr?: string; successAction?: { url?: string }; converted?: number }>(
    `${req.callback}${sep}amount=${kes}&currency=KES`,
  )
  if (!res.pr) throw new PayoutError('The payout partner did not return an invoice.', true)
  if (res.converted !== kes) throw new PayoutError('The payout partner quoted a different shilling amount.')

  const base = BigInt(kes) * BigInt(req.currency.multiplier)
  const check = validateInvoice({
    bolt11: res.pr,
    metadata: req.metadata,
    identifier: metadataIdentifier(req.metadata),
    minMsats: base,
    maxMsats: (base * BigInt(Math.round((1 + MAX_SPREAD) * 10_000))) / 10_000n,
  })
  if (!check.ok) throw new PayoutError(check.reason, true)

  return {
    bolt11: res.pr,
    paymentHash: check.paymentHash,
    msats: check.msats,
    sats: Number((check.msats + 999n) / 1000n),
    expiresAt: check.expiresAt,
    receiptUrl: res.successAction?.url ?? null,
    multiplier: req.currency.multiplier,
    metadata: req.metadata,
  }
}

export type DeliveryState =
  | { state: 'delivered'; receiptCode: string | null; kesSent: number | null; sats: number | null }
  | { state: 'failed'; reason: string }
  | { state: 'pending' }

const FAILED = new Set(['failed', 'cancelled', 'canceled', 'expired', 'error', 'refunded', 'reversed'])

/** Pure mapping, so it can be tested without the network. */
export function mapTandoStatus(body: unknown): DeliveryState {
  const b = body as {
    success?: boolean
    transaction?: {
      status?: string
      isPaid?: boolean
      paymentNetworkReceipt?: string | null
      currencyAmountSent?: number | string | null
      satsAmount?: number | string | null
    }
  }
  const tx = b?.transaction
  if (!b?.success || !tx) return { state: 'pending' }
  const num = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
    return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : null
  }
  const status = String(tx.status ?? '').toLowerCase()
  if (status === 'completed' && tx.isPaid) {
    return {
      state: 'delivered',
      receiptCode: tx.paymentNetworkReceipt ? String(tx.paymentNetworkReceipt) : null,
      kesSent: num(tx.currencyAmountSent),
      sats: num(tx.satsAmount),
    }
  }
  if (FAILED.has(status)) return { state: 'failed', reason: `The payout partner reports: ${status}.` }
  return { state: 'pending' }
}

/** Never throws: an unreachable status API is just "still pending". */
export async function getMpesaDelivery(paymentHash: string): Promise<DeliveryState & { known: boolean }> {
  try {
    const res = await payoutFetch()(`${TANDO_STATUS_BASE}/${paymentHash}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const body = await res.json().catch(() => null)
    const known = Boolean((body as { success?: boolean })?.success)
    return { ...mapTandoStatus(body), known }
  } catch {
    return { state: 'pending', known: false }
  }
}
