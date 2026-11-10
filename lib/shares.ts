import { and, eq, gt, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { ZamuError } from './errors'
import { checkLightningVerify, requestLightningAddressInvoice } from './lnaddress'
import { getMpesaDelivery, PayoutError, requestMpesaInvoice } from './tando'
import { getNimTransaction, getNimTransactionsByAddress, hexToUtf8, NIM_CONFIRMATIONS } from './nim-rpc'
import { normaliseAddress } from './nimiq-sig'
import { roundLunaPerKes, roundMsatsPerKes } from './rates'
import { advanceRoundIfComplete } from './rounds'

/**
 * One member's share in one round, from "tap to pay" to "landed".
 *
 *   issued     invoice fetched, nothing paid yet
 *   submitted  Nimiq Pay returned a transaction hash
 *   checking   Nimiq Pay could not say whether it went through
 *   delivered  the recipient has the money (M-Pesa receipt, settled invoice,
 *              or a confirmed NIM transaction)
 *   failed     the payout partner reports a failure
 *   expired    an unpaid invoice ran out (replaced on the next tap)
 *
 * Rule that everything here protects: once an invoice may have been paid, it
 * is never replaced and never paid again.
 */

export type Invoice = typeof schema.invoices.$inferSelect

const EXPIRY_GRACE_MS = 15_000

export function nimMemo(invoiceId: string): string {
  return `zamu:${invoiceId.replace(/-/g, '').slice(0, 12)}`
}

/** What the client may see about an invoice. */
export function publicInvoice(inv: Invoice) {
  return {
    id: inv.id,
    roundId: inv.roundId,
    member: inv.member,
    method: inv.method,
    status: inv.status,
    kes: inv.kes,
    sats: inv.sats,
    luna: inv.luna,
    bolt11: inv.status === 'issued' ? inv.bolt11 : null,
    paymentHash: inv.paymentHash,
    receiptUrl: inv.receiptUrl,
    receiptCode: inv.receiptCode,
    kesDelivered: inv.kesDelivered,
    expiresAt: inv.expiresAt,
    nimiqHash: inv.nimiqHash,
    swapId: inv.swapId,
    recipientNim: inv.method === 'nim' ? inv.recipientNim : null,
    memo: inv.method === 'nim' ? nimMemo(inv.id) : null,
    failureReason: inv.failureReason,
    submittedAt: inv.submittedAt,
    deliveredAt: inv.deliveredAt,
    tappedAt: inv.tappedAt,
    needsRecipientConfirm: inv.method === 'lightning' && !inv.verifyUrl && inv.status !== 'delivered',
  }
}

async function loadContext(roundId: string, member: string) {
  const db = getDb()
  const [round] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, roundId)).limit(1)
  if (!round) throw new ZamuError('Round not found.', 404)
  const [chama] = await db.select().from(schema.chamas).where(eq(schema.chamas.id, round.chamaId)).limit(1)
  const members = await db.select().from(schema.members).where(eq(schema.members.chamaId, round.chamaId))
  const me = members.find((m) => m.address === member)
  if (!me) throw new ZamuError('You are not a member of this chama.', 403)
  const recipient = members.find((m) => m.address === round.recipientAddress)
  if (!recipient) throw new ZamuError('This round has no recipient.', 409)
  return { round, chama, me, recipient }
}

async function freshPayment(params: {
  method: 'mpesa' | 'lightning' | 'nim'
  recipient: typeof schema.members.$inferSelect
  roundId: string
  kes: number
}) {
  const { method, recipient, kes } = params
  if (method === 'mpesa') {
    const inv = await requestMpesaInvoice(recipient.payoutPhone ?? '', kes)
    // Record Tando's published rate for the round, for the cost figures.
    await getDb()
      .update(schema.rounds)
      .set({ msatsPerKes: inv.multiplier })
      .where(and(eq(schema.rounds.id, params.roundId), isNull(schema.rounds.msatsPerKes)))
    return {
      bolt11: inv.bolt11,
      paymentHash: inv.paymentHash,
      msats: Number(inv.msats),
      sats: inv.sats,
      expiresAt: inv.expiresAt,
      receiptUrl: inv.receiptUrl,
      verifyUrl: null,
      luna: null,
    }
  }
  if (method === 'lightning') {
    const rate = await roundMsatsPerKes(params.roundId)
    const inv = await requestLightningAddressInvoice(recipient.payoutLightning ?? '', BigInt(kes) * BigInt(rate))
    return {
      bolt11: inv.bolt11,
      paymentHash: inv.paymentHash,
      msats: Number(inv.msats),
      sats: inv.sats,
      expiresAt: inv.expiresAt,
      receiptUrl: inv.receiptUrl,
      verifyUrl: inv.verifyUrl,
      luna: null,
    }
  }
  const lunaPerKes = await roundLunaPerKes(params.roundId)
  return {
    bolt11: null,
    paymentHash: null,
    msats: null,
    sats: null,
    expiresAt: null,
    receiptUrl: null,
    verifyUrl: null,
    luna: lunaPerKes * kes,
  }
}

function payoutError(error: unknown): never {
  if (error instanceof PayoutError) throw new ZamuError(error.message, error.retryable ? 503 : 400, 'payout')
  throw error
}

/**
 * Get the invoice for this member's share of this round, creating it if
 * needed. Returns an existing one unchanged whenever it may have been paid.
 */
export async function issueInvoice(roundId: string, member: string): Promise<Invoice> {
  const db = getDb()
  const { round, chama, recipient } = await loadContext(roundId, member)
  if (chama?.status !== 'active' || round.status !== 'open') {
    throw new ZamuError('This round is not collecting shares right now.', 409, 'round_closed')
  }
  if (round.recipientAddress === member) throw new ZamuError('It is your turn, so you receive this round.', 409, 'your_turn')

  const [existing] = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.roundId, roundId), eq(schema.invoices.member, member)))
    .limit(1)

  if (existing) {
    if (existing.nimiqHash || existing.status !== 'issued') {
      if (existing.status !== 'expired') return existing
    } else if (existing.method === 'nim') {
      return existing
    } else if (existing.expiresAt && existing.expiresAt.getTime() - Date.now() > EXPIRY_GRACE_MS) {
      return existing
    }

    // Unpaid and expired (or about to). Before replacing it, make sure nobody
    // paid it behind our back: an app crash between payment and the submit
    // call would otherwise lead to paying twice.
    if (existing.paymentHash && existing.method === 'mpesa') {
      const d = await getMpesaDelivery(existing.paymentHash)
      if (d.known) {
        const [held] = await db
          .update(schema.invoices)
          .set({ status: 'checking', lastCheckedAt: new Date() })
          .where(eq(schema.invoices.id, existing.id))
          .returning()
        return held
      }
    }
    if (existing.verifyUrl && (await checkLightningVerify(existing.verifyUrl))) {
      const [held] = await db
        .update(schema.invoices)
        .set({ status: 'checking', lastCheckedAt: new Date() })
        .where(eq(schema.invoices.id, existing.id))
        .returning()
      return held
    }

    const p = await freshPayment({ method: existing.method, recipient, roundId, kes: chama.shareKes }).catch(payoutError)
    const [replaced] = await db
      .update(schema.invoices)
      .set({ ...p, status: 'issued', tappedAt: new Date(), failureReason: null })
      .where(and(eq(schema.invoices.id, existing.id), isNull(schema.invoices.nimiqHash)))
      .returning()
    if (!replaced) {
      const [now] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, existing.id))
      return now
    }
    return replaced
  }

  const method = recipient.payoutMethod
  const p = await freshPayment({ method, recipient, roundId, kes: chama.shareKes }).catch(payoutError)
  const [created] = await db
    .insert(schema.invoices)
    .values({
      roundId,
      member,
      method,
      recipientAddress: recipient.address,
      recipientPhone: recipient.payoutPhone,
      recipientLightning: recipient.payoutLightning,
      recipientNim: recipient.payoutNim,
      kes: chama.shareKes,
      ...p,
      status: 'issued',
    })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  // Lost a race with a second tap: return the winner's invoice.
  const [winner] = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.roundId, roundId), eq(schema.invoices.member, member)))
  return winner
}

async function ownInvoice(id: string, member: string): Promise<Invoice> {
  const [inv] = await getDb().select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1)
  if (!inv) throw new ZamuError('Invoice not found.', 404)
  if (inv.member !== member) throw new ZamuError('That is not your invoice.', 403)
  return inv
}

const HASH_RE = /^[0-9a-zA-Z:_-]{8,200}$/

/** Nimiq Pay returned a transaction hash. From now on the button stays disabled. */
export async function markSubmitted(params: { id: string; member: string; hash: string; swapId?: string | null }) {
  const db = getDb()
  const inv = await ownInvoice(params.id, params.member)
  if (!HASH_RE.test(params.hash)) throw new ZamuError('That is not a transaction hash.')
  if (inv.nimiqHash && inv.nimiqHash !== params.hash) {
    throw new ZamuError('A different payment is already recorded for this share.', 409)
  }
  if (inv.status === 'delivered') return inv
  try {
    const [updated] = await db
      .update(schema.invoices)
      .set({
        nimiqHash: params.hash,
        swapId: params.swapId ?? inv.swapId,
        status: inv.status === 'issued' || inv.status === 'checking' || inv.status === 'expired' ? 'submitted' : inv.status,
        submittedAt: inv.submittedAt ?? new Date(),
      })
      .where(eq(schema.invoices.id, inv.id))
      .returning()
    return updated
  } catch (error) {
    if (/invoices_nimiq_hash_idx/.test(String((error as Error)?.message))) {
      throw new ZamuError('That transaction is already recorded for another share.', 409)
    }
    throw error
  }
}

/**
 * Nimiq Pay said DUPLICATE_PAYMENT or TRANSACTION_OUTCOME_UNKNOWN. Never retry:
 * keep whatever identifiers it gave us and let the status checks decide.
 */
export async function markUncertain(params: { id: string; member: string; hash?: string | null; swapId?: string | null }) {
  const db = getDb()
  const inv = await ownInvoice(params.id, params.member)
  if (inv.status === 'delivered' || inv.status === 'failed') return inv
  const hash = params.hash && HASH_RE.test(params.hash) && !inv.nimiqHash ? params.hash : inv.nimiqHash
  const [updated] = await db
    .update(schema.invoices)
    .set({
      status: 'checking',
      nimiqHash: hash,
      swapId: params.swapId ?? inv.swapId,
      submittedAt: inv.submittedAt ?? new Date(),
    })
    .where(eq(schema.invoices.id, inv.id))
    .returning()
  return updated
}

async function markDelivered(inv: Invoice, fields: { receiptCode?: string | null; kesDelivered?: number | null; sats?: number | null }) {
  const db = getDb()
  const [updated] = await db
    .update(schema.invoices)
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
      receiptCode: fields.receiptCode ?? inv.receiptCode,
      kesDelivered: fields.kesDelivered ?? inv.kesDelivered ?? inv.kes,
      sats: inv.sats ?? fields.sats ?? null,
      lastCheckedAt: new Date(),
    })
    .where(and(eq(schema.invoices.id, inv.id), inArray(schema.invoices.status, ['issued', 'submitted', 'checking', 'expired'])))
    .returning()
  if (updated) await advanceRoundIfComplete(inv.roundId)
  return updated ?? inv
}

async function verifyNimPayment(inv: Invoice): Promise<'delivered' | 'pending' | { failed: string }> {
  if (!inv.recipientNim || !inv.luna) return 'pending'
  const memo = nimMemo(inv.id)
  const to = normaliseAddress(inv.recipientNim)
  const matches = (tx: { to: string; value: number; recipientData?: string; executionResult: boolean; confirmations: number }) =>
    normaliseAddress(tx.to) === to && hexToUtf8(tx.recipientData).includes(memo)

  try {
    if (inv.nimiqHash && /^[0-9a-f]{64}$/i.test(inv.nimiqHash)) {
      const tx = await getNimTransaction(inv.nimiqHash)
      if (tx && matches(tx)) {
        if (!tx.executionResult) return { failed: 'The NIM transaction failed on-chain.' }
        if (tx.value < inv.luna) return { failed: 'The NIM payment was less than the share.' }
        return tx.confirmations >= NIM_CONFIRMATIONS ? 'delivered' : 'pending'
      }
    }
    // The host may return a serialised transaction instead of a hash; find
    // the payment by its memo in the recipient's history instead.
    const history = await getNimTransactionsByAddress(inv.recipientNim, 50)
    const tx = history.find(matches)
    if (!tx) return 'pending'
    if (!tx.executionResult) return { failed: 'The NIM transaction failed on-chain.' }
    if (tx.value < inv.luna) return { failed: 'The NIM payment was less than the share.' }
    return tx.confirmations >= NIM_CONFIRMATIONS ? 'delivered' : 'pending'
  } catch {
    return 'pending'
  }
}

/**
 * Look at the outside world once and move the invoice forward if it moved.
 * Never throws for network trouble: an unreachable partner means "pending".
 */
export async function refreshInvoice(inv: Invoice): Promise<Invoice> {
  const db = getDb()
  if (inv.status === 'delivered' || inv.status === 'failed') return inv

  const touch = () =>
    db.update(schema.invoices).set({ lastCheckedAt: new Date() }).where(eq(schema.invoices.id, inv.id))

  if (inv.method === 'mpesa' && inv.paymentHash) {
    // An unsubmitted, still-issued invoice can only have moved if someone paid it.
    const d = await getMpesaDelivery(inv.paymentHash)
    if (d.state === 'delivered') {
      return markDelivered(inv, { receiptCode: d.receiptCode, kesDelivered: d.kesSent, sats: d.sats })
    }
    if (d.state === 'failed' && (inv.nimiqHash || inv.status !== 'issued')) {
      const [u] = await db
        .update(schema.invoices)
        .set({ status: 'failed', failureReason: d.reason, lastCheckedAt: new Date() })
        .where(eq(schema.invoices.id, inv.id))
        .returning()
      return u
    }
    if (inv.status === 'issued' && !d.known && inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
      const [u] = await db
        .update(schema.invoices)
        .set({ status: 'expired', lastCheckedAt: new Date() })
        .where(and(eq(schema.invoices.id, inv.id), isNull(schema.invoices.nimiqHash)))
        .returning()
      return u ?? inv
    }
    await touch()
    return inv
  }

  if (inv.method === 'lightning') {
    if (inv.verifyUrl && (inv.nimiqHash || inv.status !== 'issued')) {
      const settled = await checkLightningVerify(inv.verifyUrl)
      if (settled) return markDelivered(inv, {})
    }
    await touch()
    return inv
  }

  if (inv.method === 'nim' && (inv.nimiqHash || inv.status !== 'issued')) {
    const r = await verifyNimPayment(inv)
    if (r === 'delivered') return markDelivered(inv, { kesDelivered: inv.kes })
    if (typeof r === 'object') {
      const [u] = await db
        .update(schema.invoices)
        .set({ status: 'failed', failureReason: r.failed, lastCheckedAt: new Date() })
        .where(eq(schema.invoices.id, inv.id))
        .returning()
      return u
    }
  }
  await touch()
  return inv
}

/** The share's own status, for the 3-second poll while the pay sheet is open. */
export async function invoiceStatus(id: string, viewer: string): Promise<Invoice> {
  const db = getDb()
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1)
  if (!inv) throw new ZamuError('Invoice not found.', 404)
  if (inv.member !== viewer && inv.recipientAddress !== viewer) {
    const [round] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, inv.roundId))
    const [m] = await db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(and(eq(schema.members.chamaId, round.chamaId), eq(schema.members.address, viewer)))
    if (!m) throw new ZamuError('You are not a member of this chama.', 403)
  }
  return refreshInvoice(inv)
}

/**
 * Lightning addresses without a verify URL: the recipient taps "I received it".
 * Only possible after Nimiq Pay returned a hash for the payment.
 */
export async function confirmReceived(id: string, recipient: string) {
  const db = getDb()
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1)
  if (!inv) throw new ZamuError('Invoice not found.', 404)
  if (inv.recipientAddress !== recipient) throw new ZamuError('Only the recipient can confirm this.', 403)
  if (inv.method !== 'lightning') throw new ZamuError('This share is confirmed automatically.', 409)
  if (!inv.nimiqHash) throw new ZamuError('This share has not been paid yet.', 409)
  await db.update(schema.invoices).set({ recipientConfirmedAt: new Date() }).where(eq(schema.invoices.id, id))
  return markDelivered(inv, {})
}

/**
 * The scheduled job: re-check every undelivered share that may have been paid
 * in the last 24 hours.
 */
export async function recheckOpenInvoices(): Promise<{ checked: number; delivered: number; failed: number }> {
  const db = getDb()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await db
    .select()
    .from(schema.invoices)
    .where(
      and(
        gt(schema.invoices.tappedAt, since),
        or(
          inArray(schema.invoices.status, ['submitted', 'checking']),
          and(eq(schema.invoices.status, 'issued'), isNotNull(schema.invoices.paymentHash)),
        ),
      ),
    )
    .limit(200)

  let delivered = 0
  let failed = 0
  for (const inv of rows) {
    const after = await refreshInvoice(inv)
    if (after.status === 'delivered') delivered += 1
    if (after.status === 'failed') failed += 1
  }
  return { checked: rows.length, delivered, failed }
}
