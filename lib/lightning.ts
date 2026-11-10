import { decode } from 'light-bolt11-decoder'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * BOLT11 checks shared by every Lightning payout.
 *
 * An invoice comes from someone else's server. Before a member pays it we prove
 * it is for mainnet, for the amount we asked for, bound to the person we meant
 * to pay, and alive long enough to finish paying.
 */

export interface DecodedInvoice {
  network: 'mainnet' | 'testnet' | 'regtest' | 'signet' | 'unknown'
  msats: bigint | null
  paymentHash: string | null
  description: string | null
  descriptionHash: string | null
  timestamp: number
  expirySeconds: number
  expiresAt: Date
}

export function decodeInvoice(bolt11: string): DecodedInvoice {
  const pr = bolt11.trim().toLowerCase().replace(/^lightning:/, '')
  const d = decode(pr)
  const section = (name: string) => d.sections.find((s) => s.name === name) as { value?: unknown } | undefined

  const prefix = pr.slice(0, pr.lastIndexOf('1'))
  const network = prefix.startsWith('lnbcrt')
    ? 'regtest'
    : prefix.startsWith('lntbs')
      ? 'signet'
      : prefix.startsWith('lntb')
        ? 'testnet'
        : prefix.startsWith('lnbc')
          ? 'mainnet'
          : 'unknown'

  const amount = section('amount')?.value
  const timestamp = Number(section('timestamp')?.value ?? 0)
  const expirySeconds = Number(d.expiry ?? section('expiry')?.value ?? 3600)

  return {
    network,
    msats: amount !== undefined && amount !== null ? BigInt(String(amount)) : null,
    paymentHash: (section('payment_hash')?.value as string | undefined) ?? null,
    description: (section('description')?.value as string | undefined) ?? null,
    descriptionHash: (section('description_hash')?.value as string | undefined) ?? null,
    timestamp,
    expirySeconds,
    expiresAt: new Date((timestamp + expirySeconds) * 1000),
  }
}

export function sha256Hex(text: string): string {
  return Array.from(sha256(new TextEncoder().encode(text)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The text/identifier entry of an LNURL-pay metadata string, if any. */
export function metadataIdentifier(metadata: string): string | null {
  try {
    const entries = JSON.parse(metadata) as [string, string][]
    const found = entries.find(([k]) => k === 'text/identifier' || k === 'text/email')
    return found ? found[1] : null
  } catch {
    return null
  }
}

/**
 * Seconds of life an invoice must still have when we hand it to Nimiq Pay.
 * Tando invoices live 120 s in total, so this leaves time for the swap quote
 * and the member's confirmation without accepting a near-dead invoice.
 */
export const MIN_INVOICE_LIFETIME_S = 45

export type InvoiceCheck =
  | { ok: true; paymentHash: string; msats: bigint; expiresAt: Date }
  | { ok: false; reason: string }

export function validateInvoice(params: {
  bolt11: string
  metadata: string
  /** Lowest acceptable amount, in msats. */
  minMsats: bigint
  /** Highest acceptable amount, in msats. */
  maxMsats: bigint
  /** Text the plain description must contain when there is no description hash. */
  identifier?: string | null
  now?: Date
  minLifetimeSeconds?: number
}): InvoiceCheck {
  let inv: DecodedInvoice
  try {
    inv = decodeInvoice(params.bolt11)
  } catch {
    return { ok: false, reason: 'The payout partner returned an unreadable invoice.' }
  }

  if (inv.network !== 'mainnet') {
    return { ok: false, reason: `That invoice is for ${inv.network}, not Bitcoin mainnet.` }
  }
  if (!inv.paymentHash || !/^[0-9a-f]{64}$/.test(inv.paymentHash)) {
    return { ok: false, reason: 'That invoice has no payment hash.' }
  }
  if (inv.msats === null) {
    return { ok: false, reason: 'That invoice has no fixed amount.' }
  }
  if (inv.msats < params.minMsats || inv.msats > params.maxMsats) {
    return { ok: false, reason: 'The invoice amount does not match the share.' }
  }

  const now = (params.now ?? new Date()).getTime()
  const minLife = (params.minLifetimeSeconds ?? MIN_INVOICE_LIFETIME_S) * 1000
  if (inv.expiresAt.getTime() - now < minLife) {
    return { ok: false, reason: 'That invoice is about to expire.' }
  }

  // Bound to the recipient: either the standard LNURL description hash, or a
  // plain description naming the same identifier as the metadata.
  if (inv.descriptionHash) {
    if (inv.descriptionHash.toLowerCase() !== sha256Hex(params.metadata)) {
      return { ok: false, reason: 'That invoice is not bound to this recipient.' }
    }
  } else {
    const id = params.identifier ?? metadataIdentifier(params.metadata)
    if (!id || !inv.description || !inv.description.toLowerCase().includes(id.toLowerCase())) {
      return { ok: false, reason: 'That invoice is not bound to this recipient.' }
    }
  }

  return { ok: true, paymentHash: inv.paymentHash, msats: inv.msats, expiresAt: inv.expiresAt }
}
