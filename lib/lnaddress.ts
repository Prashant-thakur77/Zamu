import { validateInvoice } from './lightning'
import { payoutFetch } from './payout-fetch'
import { PayoutError } from './tando'

/**
 * Lightning addresses (LUD-16): `name@domain` resolves to an LNURL-pay
 * endpoint at https://domain/.well-known/lnurlp/name. Any wallet, any country.
 */

export function parseLightningAddress(input: string): { name: string; domain: string } | null {
  const m = input.trim().toLowerCase().match(/^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/)
  if (!m) return null
  return { name: m[1], domain: m[2] }
}

export function normaliseLightningAddress(input: string): string | null {
  const p = parseLightningAddress(input)
  return p ? `${p.name}@${p.domain}` : null
}

interface PayRequest {
  tag?: string
  callback: string
  metadata: string
  minSendable: number
  maxSendable: number
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
    throw new PayoutError('Could not reach that Lightning address. Try again in a moment.', true)
  }
  const body = (await res.json().catch(() => null)) as (T & { status?: string; reason?: string }) | null
  if (!body) throw new PayoutError('That Lightning address returned an unexpected reply.', true)
  if (body.status === 'ERROR') throw new PayoutError(body.reason || 'That Lightning address refused the request.')
  if (!res.ok) throw new PayoutError(`That Lightning address refused the request (${res.status}).`, res.status >= 500)
  return body
}

export async function resolveLightningAddress(address: string): Promise<PayRequest> {
  const p = parseLightningAddress(address)
  if (!p) throw new PayoutError('That is not a Lightning address (name@domain).')
  const host = p.domain
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    throw new PayoutError('That is not a Lightning address (name@domain).')
  }
  const req = await getJson<PayRequest>(`https://${host}/.well-known/lnurlp/${encodeURIComponent(p.name)}`)
  if (req.tag && req.tag !== 'payRequest') throw new PayoutError('That address does not accept payments.')
  if (!req.callback || !req.metadata) throw new PayoutError('That Lightning address is not set up to receive.')
  return req
}

export interface LightningAddressInvoice {
  bolt11: string
  paymentHash: string
  msats: bigint
  sats: number
  expiresAt: Date
  verifyUrl: string | null
  receiptUrl: string | null
}

export async function requestLightningAddressInvoice(address: string, msats: bigint): Promise<LightningAddressInvoice> {
  const req = await resolveLightningAddress(address)
  if (msats < BigInt(req.minSendable) || msats > BigInt(req.maxSendable)) {
    throw new PayoutError('That Lightning address does not accept this amount.')
  }
  const sep = req.callback.includes('?') ? '&' : '?'
  const res = await getJson<{ pr?: string; verify?: string; successAction?: { tag?: string; url?: string } }>(
    `${req.callback}${sep}amount=${msats.toString()}`,
  )
  if (!res.pr) throw new PayoutError('That Lightning address did not return an invoice.', true)

  const check = validateInvoice({
    bolt11: res.pr,
    metadata: req.metadata,
    minMsats: msats,
    maxMsats: msats,
    // Some services put the address in a plain description instead of hashing
    // the metadata; accept that only when it names this exact address.
    identifier: address,
  })
  if (!check.ok) throw new PayoutError(check.reason, true)

  return {
    bolt11: res.pr,
    paymentHash: check.paymentHash,
    msats: check.msats,
    sats: Number((check.msats + 999n) / 1000n),
    expiresAt: check.expiresAt,
    verifyUrl: typeof res.verify === 'string' && /^https:\/\//.test(res.verify) ? res.verify : null,
    receiptUrl: res.successAction?.tag === 'url' && res.successAction.url ? res.successAction.url : null,
  }
}

/** LUD-21: `{ settled: boolean }`. Null when there is no verify URL or it is unreachable. */
export async function checkLightningVerify(verifyUrl: string): Promise<boolean | null> {
  try {
    const res = await payoutFetch()(verifyUrl, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    const body = (await res.json()) as { settled?: boolean; status?: string }
    if (body.status === 'ERROR') return null
    return typeof body.settled === 'boolean' ? body.settled : null
  } catch {
    return null
  }
}
