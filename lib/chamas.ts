import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { buildAgreement, type Frequency } from './agreement'
import { ZamuError } from './errors'
import { normaliseLightningAddress } from './lnaddress'
import { isValidNimAddress, normaliseAddress, verifyNimiqMessage } from './nimiq-sig'
import { normaliseKenyanPhone } from './phone'
import { KES_MAX, KES_MIN } from './tando'
import { activateRounds, openDueRounds } from './rounds'

export type { Frequency }
export type PayoutMethod = 'mpesa' | 'lightning' | 'nim'

/** Ambiguous characters removed: these codes are read aloud and typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(length = 6): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export interface PayoutInput {
  method: PayoutMethod
  phone?: string
  lightning?: string
  nim?: string
}

export function normalisePayout(input: PayoutInput): {
  payoutMethod: PayoutMethod
  payoutPhone: string | null
  payoutLightning: string | null
  payoutNim: string | null
} {
  if (input.method === 'mpesa') {
    const phone = normaliseKenyanPhone(input.phone ?? '')
    if (!phone) throw new ZamuError('Enter a Safaricom M-Pesa number, like 0712 345 678.', 400, 'bad_phone')
    return { payoutMethod: 'mpesa', payoutPhone: phone, payoutLightning: null, payoutNim: null }
  }
  if (input.method === 'lightning') {
    const ln = normaliseLightningAddress(input.lightning ?? '')
    if (!ln) throw new ZamuError('Enter a Lightning address, like name@wallet.com.', 400, 'bad_lightning')
    return { payoutMethod: 'lightning', payoutPhone: null, payoutLightning: ln, payoutNim: null }
  }
  if (input.method === 'nim') {
    const nim = input.nim ?? ''
    if (!isValidNimAddress(nim)) throw new ZamuError('That is not a valid Nimiq address.', 400, 'bad_nim')
    const n = normaliseAddress(nim).replace(/.{4}/g, '$& ').trim()
    return { payoutMethod: 'nim', payoutPhone: null, payoutLightning: null, payoutNim: n }
  }
  throw new ZamuError('Choose how you want to receive your turn.')
}

export function payoutDestination(m: {
  payoutMethod: PayoutMethod
  payoutPhone: string | null
  payoutLightning: string | null
  payoutNim: string | null
}): string {
  return (m.payoutMethod === 'mpesa' ? m.payoutPhone : m.payoutMethod === 'lightning' ? m.payoutLightning : m.payoutNim) ?? ''
}

function cleanName(name: string): string {
  const n = name.replace(/\s+/g, ' ').trim()
  if (n.length < 2) throw new ZamuError('Enter your name as the group knows you.', 400, 'bad_name')
  if (n.length > 40) throw new ZamuError('That name is too long.', 400, 'bad_name')
  return n
}

async function ensureUser(address: string) {
  await getDb().insert(schema.users).values({ address }).onConflictDoNothing()
}

export async function createChama(params: {
  creator: string
  name: string
  shareKes: number
  frequency: Frequency
  size: number
  skipUntilPaidUp: boolean
  displayName: string
  payout: PayoutInput
  consent: boolean
  startsAt?: Date | null
}) {
  const name = params.name.replace(/\s+/g, ' ').trim()
  if (name.length < 2) throw new ZamuError('Give the chama a name.', 400, 'bad_chama_name')
  if (name.length > 48) throw new ZamuError('That chama name is too long.', 400, 'bad_chama_name')
  if (!Number.isInteger(params.shareKes) || params.shareKes < KES_MIN || params.shareKes > KES_MAX) {
    throw new ZamuError(`A share must be between KSh ${KES_MIN} and KSh ${KES_MAX.toLocaleString('en-US')}.`, 400, 'bad_amount')
  }
  if (!Number.isInteger(params.size) || params.size < 2 || params.size > 30) {
    throw new ZamuError('A chama needs between 2 and 30 members.', 400, 'bad_size')
  }
  if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(params.frequency)) {
    throw new ZamuError('Choose how often the chama meets.')
  }
  if (!params.consent) throw new ZamuError('Tick the box to share your payout details with the group.', 400, 'no_consent')
  const displayName = cleanName(params.displayName)
  const payout = normalisePayout(params.payout)

  const db = getDb()
  await ensureUser(params.creator)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [chama] = await db
        .insert(schema.chamas)
        .values({
          name,
          shareKes: params.shareKes,
          frequency: params.frequency,
          size: params.size,
          skipUntilPaidUp: params.skipUntilPaidUp,
          creatorAddress: params.creator,
          inviteCode: generateInviteCode(),
          startsAt: params.startsAt ?? null,
        })
        .returning()
      await db.insert(schema.members).values({
        chamaId: chama.id,
        address: params.creator,
        displayName,
        consentAt: new Date(),
        ...payout,
      })
      return chama
    } catch (error) {
      if (!/chamas_invite_code_idx/.test(String((error as Error)?.message ?? ''))) throw error
    }
  }
  throw new ZamuError('Could not create a unique invite code. Try again.', 500)
}

export async function findChamaByCode(code: string) {
  const [chama] = await getDb()
    .select()
    .from(schema.chamas)
    .where(eq(schema.chamas.inviteCode, code.trim().toUpperCase()))
    .limit(1)
  return chama ?? null
}

/** What someone with the code may see before joining. No phone numbers. */
export async function previewChama(code: string) {
  const chama = await findChamaByCode(code)
  if (!chama) throw new ZamuError('No chama found with that code.', 404, 'no_chama')
  const members = await getDb()
    .select({ displayName: schema.members.displayName })
    .from(schema.members)
    .where(eq(schema.members.chamaId, chama.id))
    .orderBy(asc(schema.members.joinedAt))
  return {
    name: chama.name,
    shareKes: chama.shareKes,
    frequency: chama.frequency,
    size: chama.size,
    status: chama.status,
    skipUntilPaidUp: chama.skipUntilPaidUp,
    members: members.map((m) => m.displayName),
  }
}

export async function joinChama(params: {
  address: string
  inviteCode: string
  displayName: string
  payout: PayoutInput
  consent: boolean
}) {
  const db = getDb()
  const chama = await findChamaByCode(params.inviteCode)
  if (!chama) throw new ZamuError('No chama found with that code.', 404, 'no_chama')

  const [existing] = await db
    .select()
    .from(schema.members)
    .where(and(eq(schema.members.chamaId, chama.id), eq(schema.members.address, params.address)))
    .limit(1)
  if (existing) return chama

  if (chama.status !== 'forming') {
    throw new ZamuError('That chama has already started, so it cannot take new members.', 409, 'started')
  }
  if (!params.consent) throw new ZamuError('Tick the box to share your payout details with the group.', 400, 'no_consent')
  const displayName = cleanName(params.displayName)
  const payout = normalisePayout(params.payout)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.members)
    .where(eq(schema.members.chamaId, chama.id))
  if (count >= chama.size) throw new ZamuError('That chama is already full.', 409, 'full')

  await ensureUser(params.address)
  await db
    .insert(schema.members)
    .values({ chamaId: chama.id, address: params.address, displayName, consentAt: new Date(), ...payout })
    .onConflictDoNothing()
  return chama
}

/** Change your own payout destination while the chama is still forming. */
export async function updatePayout(params: { chamaId: string; address: string; payout: PayoutInput; consent: boolean }) {
  const db = getDb()
  const [chama] = await db.select().from(schema.chamas).where(eq(schema.chamas.id, params.chamaId)).limit(1)
  if (!chama) throw new ZamuError('Chama not found.', 404)
  if (chama.status !== 'forming') throw new ZamuError('Payout details are fixed once the order is set.', 409)
  if (!params.consent) throw new ZamuError('Tick the box to share your payout details with the group.', 400, 'no_consent')
  const payout = normalisePayout(params.payout)
  await db
    .update(schema.members)
    .set({ ...payout, consentAt: new Date() })
    .where(and(eq(schema.members.chamaId, params.chamaId), eq(schema.members.address, params.address)))
}

async function loadChama(chamaId: string) {
  const [chama] = await getDb().select().from(schema.chamas).where(eq(schema.chamas.id, chamaId)).limit(1)
  if (!chama) throw new ZamuError('Chama not found.', 404)
  return chama
}

async function loadMembers(chamaId: string) {
  return getDb()
    .select()
    .from(schema.members)
    .where(eq(schema.members.chamaId, chamaId))
    .orderBy(asc(schema.members.payoutPosition), asc(schema.members.joinedAt))
}

/**
 * Fix the rotation order. After this every member signs the agreement, and
 * the first round opens when the last signature lands.
 */
export async function lockChama(params: { chamaId: string; caller: string; order?: string[] }) {
  const db = getDb()
  const chama = await loadChama(params.chamaId)
  if (chama.creatorAddress !== params.caller) {
    throw new ZamuError('Only the person who started the chama can set the order.', 403)
  }
  if (chama.status !== 'forming') throw new ZamuError('The order is already set.', 409)

  const members = await loadMembers(chama.id)
  if (members.length < 2) throw new ZamuError('A chama needs at least 2 members before it can start.', 400, 'too_few')

  const order = params.order?.length ? params.order : members.map((m) => m.address)
  const set = new Set(members.map((m) => m.address))
  if (order.length !== members.length || new Set(order).size !== order.length || !order.every((a) => set.has(a))) {
    throw new ZamuError('The order must list every member exactly once.')
  }

  for (const [i, address] of order.entries()) {
    await db
      .update(schema.members)
      .set({ payoutPosition: i + 1 })
      .where(and(eq(schema.members.chamaId, chama.id), eq(schema.members.address, address)))
  }

  const [updated] = await db
    .update(schema.chamas)
    .set({ status: 'signing', lockedAt: new Date(), size: order.length })
    .where(and(eq(schema.chamas.id, chama.id), eq(schema.chamas.status, 'forming')))
    .returning()
  if (!updated) throw new ZamuError('The order is already set.', 409)
  return updated
}

export async function cancelChama(params: { chamaId: string; caller: string }) {
  const chama = await loadChama(params.chamaId)
  if (chama.creatorAddress !== params.caller) throw new ZamuError('Only the person who started the chama can cancel it.', 403)
  if (chama.status !== 'forming' && chama.status !== 'signing') {
    throw new ZamuError('A chama cannot be cancelled once money has started moving.', 409)
  }
  await getDb().update(schema.chamas).set({ status: 'cancelled' }).where(eq(schema.chamas.id, chama.id))
}

/** The exact text `address` must sign for this chama. */
export async function agreementFor(chamaId: string, address: string): Promise<string> {
  const chama = await loadChama(chamaId)
  if (!chama.lockedAt) throw new ZamuError('The order is not set yet.', 409)
  const members = await loadMembers(chamaId)
  const me = members.find((m) => m.address === address)
  if (!me) throw new ZamuError('You are not a member of this chama.', 403)
  return buildAgreement({
    chamaName: chama.name,
    inviteCode: chama.inviteCode,
    shareKes: chama.shareKes,
    frequency: chama.frequency,
    skipUntilPaidUp: chama.skipUntilPaidUp,
    order: members.map((m) => ({ name: m.displayName, address: m.address })),
    signer: {
      name: me.displayName,
      address: me.address,
      payoutMethod: me.payoutMethod === 'mpesa' ? 'M-Pesa' : me.payoutMethod === 'lightning' ? 'Lightning' : 'NIM',
      payoutDestination: payoutDestination(me),
    },
    date: chama.lockedAt,
  })
}

export async function signAgreement(params: {
  chamaId: string
  address: string
  publicKey: string
  signature: string
}) {
  const db = getDb()
  const chama = await loadChama(params.chamaId)
  if (chama.status !== 'signing' && chama.status !== 'active') {
    throw new ZamuError('There is nothing to sign yet.', 409)
  }
  const message = await agreementFor(params.chamaId, params.address)
  const ok = verifyNimiqMessage({
    message,
    publicKey: params.publicKey,
    signature: params.signature,
    expectedAddress: params.address,
  })
  if (!ok) throw new ZamuError('That signature does not match the agreement.', 400, 'bad_signature')

  await db
    .update(schema.members)
    .set({
      agreementMessage: message,
      agreementPublicKey: params.publicKey,
      agreementSignature: params.signature,
      agreementSignedAt: new Date(),
    })
    .where(
      and(
        eq(schema.members.chamaId, params.chamaId),
        eq(schema.members.address, params.address),
        isNull(schema.members.agreementSignedAt),
      ),
    )

  const unsigned = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(and(eq(schema.members.chamaId, params.chamaId), isNull(schema.members.agreementSignedAt)))

  if (unsigned.length === 0 && chama.status === 'signing') await activateRounds(params.chamaId)
}

/**
 * Everything a member's board needs. Phone numbers and payout details are only
 * ever returned from here, and only to members of this chama.
 */
export async function getChamaForMember(chamaId: string, address: string) {
  const db = getDb()
  await openDueRounds(chamaId)

  const chama = await loadChama(chamaId)
  const members = await loadMembers(chamaId)
  if (!members.some((m) => m.address === address)) throw new ZamuError('You are not a member of this chama.', 403)

  const rounds = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.chamaId, chamaId))
    .orderBy(asc(schema.rounds.index))

  const invoices = rounds.length
    ? await db.select().from(schema.invoices).where(inArray(schema.invoices.roundId, rounds.map((r) => r.id)))
    : []

  return { chama, members, rounds, invoices }
}

export async function listChamasFor(address: string) {
  const db = getDb()
  const rows = await db
    .select({ chama: schema.chamas })
    .from(schema.members)
    .innerJoin(schema.chamas, eq(schema.chamas.id, schema.members.chamaId))
    .where(eq(schema.members.address, address))

  const chamaIds = rows.map((r) => r.chama.id)
  const openRounds = chamaIds.length
    ? await db
        .select()
        .from(schema.rounds)
        .where(and(inArray(schema.rounds.chamaId, chamaIds), eq(schema.rounds.status, 'open')))
    : []
  const myInvoices = openRounds.length
    ? await db
        .select()
        .from(schema.invoices)
        .where(and(inArray(schema.invoices.roundId, openRounds.map((r) => r.id)), eq(schema.invoices.member, address)))
    : []
  const memberCounts = chamaIds.length
    ? await db
        .select({ chamaId: schema.members.chamaId, count: sql<number>`count(*)::int`, signed: sql<number>`count(${schema.members.agreementSignedAt})::int` })
        .from(schema.members)
        .where(inArray(schema.members.chamaId, chamaIds))
        .groupBy(schema.members.chamaId)
    : []

  const recipients = openRounds.length
    ? await db
        .select({ chamaId: schema.members.chamaId, address: schema.members.address, name: schema.members.displayName })
        .from(schema.members)
        .where(inArray(schema.members.chamaId, openRounds.map((r) => r.chamaId)))
    : []

  const list = rows.map(({ chama }) => {
    const round = openRounds.find((r) => r.chamaId === chama.id) ?? null
    const inv = round ? myInvoices.find((i) => i.roundId === round.id) : undefined
    const counts = memberCounts.find((c) => c.chamaId === chama.id)
    const youOwe = Boolean(round && round.recipientAddress !== address && inv?.status !== 'delivered')
    const recipient = round ? recipients.find((m) => m.chamaId === chama.id && m.address === round.recipientAddress) : undefined
    return {
      id: chama.id,
      name: chama.name,
      shareKes: chama.shareKes,
      frequency: chama.frequency,
      size: chama.size,
      status: chama.status,
      inviteCode: chama.inviteCode,
      memberCount: counts?.count ?? 0,
      signedCount: counts?.signed ?? 0,
      openRound: round ? { index: round.index, dueAt: round.dueAt, recipientName: recipient?.name ?? '', yourTurn: round.recipientAddress === address } : null,
      youOwe,
      createdAt: chama.createdAt,
    }
  })

  const rank = (c: (typeof list)[number]) =>
    c.youOwe ? 0 : c.openRound?.yourTurn ? 1 : c.status === 'active' ? 2 : c.status === 'signing' ? 3 : c.status === 'forming' ? 4 : 5
  return list.sort((a, b) => rank(a) - rank(b) || b.createdAt.getTime() - a.createdAt.getTime())
}

/** A member's signed agreement, for any member of the same chama to read and check. */
export async function signedAgreement(chamaId: string, viewer: string, address: string) {
  const members = await loadMembers(chamaId)
  if (!members.some((m) => m.address === viewer)) throw new ZamuError('You are not a member of this chama.', 403)
  const m = members.find((x) => x.address === address)
  if (!m?.agreementSignedAt) throw new ZamuError('Not signed yet.', 404)
  return {
    name: m.displayName,
    address: m.address,
    message: m.agreementMessage,
    publicKey: m.agreementPublicKey,
    signature: m.agreementSignature,
    signedAt: m.agreementSignedAt,
    valid: verifyNimiqMessage({
      message: m.agreementMessage ?? '',
      publicKey: m.agreementPublicKey ?? '',
      signature: m.agreementSignature ?? '',
      expectedAddress: m.address,
    }),
  }
}
