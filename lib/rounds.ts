import { and, asc, eq, gt, inArray, lte } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { Frequency } from './agreement'

const INTERVAL_DAYS: Record<Frequency, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }

export function addInterval(from: Date, frequency: Frequency, periods: number): Date {
  const next = new Date(from)
  if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + periods)
    return next
  }
  next.setDate(next.getDate() + INTERVAL_DAYS[frequency] * periods)
  return next
}

/**
 * Lay out every round once the last member has signed, and open round 1 if
 * its day has come. The recipient never pays in their own round, so each round
 * collects (members - 1) shares and everyone ends up even.
 */
export async function activateRounds(chamaId: string): Promise<void> {
  const db = getDb()
  const [chama] = await db.select().from(schema.chamas).where(eq(schema.chamas.id, chamaId)).limit(1)
  if (!chama || chama.status !== 'signing') return

  const [claimed] = await db
    .update(schema.chamas)
    .set({ status: 'active', activatedAt: new Date() })
    .where(and(eq(schema.chamas.id, chamaId), eq(schema.chamas.status, 'signing')))
    .returning()
  if (!claimed) return

  const members = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.chamaId, chamaId))
    .orderBy(asc(schema.members.payoutPosition))

  const now = new Date()
  const start = chama.startsAt && chama.startsAt > now ? chama.startsAt : now
  await db.update(schema.chamas).set({ startsAt: start }).where(eq(schema.chamas.id, chamaId))

  await db.insert(schema.rounds).values(
    members.map((m, i) => {
      const opensAt = addInterval(start, chama.frequency, i)
      return {
        chamaId,
        index: i + 1,
        recipientAddress: m.address,
        opensAt,
        dueAt: addInterval(start, chama.frequency, i + 1),
        status: 'upcoming' as const,
      }
    }),
  )

  await openDueRounds(chamaId)
}

type Round = typeof schema.rounds.$inferSelect
type Invoice = typeof schema.invoices.$inferSelect

/**
 * Has `address` paid every share due before round `beforeIndex`? Pure, so the
 * skip rule can be tested without a database.
 */
export function isPaidUp(address: string, rounds: Round[], invoices: Invoice[], beforeIndex: number): boolean {
  for (const r of rounds) {
    if (r.index >= beforeIndex) continue
    if (r.status === 'upcoming') continue
    if (r.recipientAddress === address) continue
    const inv = invoices.find((i) => i.roundId === r.id && i.member === address)
    if (inv?.status !== 'delivered') return false
  }
  return true
}

/**
 * The skip-until-paid-up rule. If the round about to open belongs to someone
 * who still owes earlier shares, swap their turn with the next paid-up member
 * in a later round. Pure: returns the swap to apply, or null.
 */
export function planSkip(
  opening: Round,
  rounds: Round[],
  invoices: Invoice[],
): { swapWith: Round } | null {
  if (isPaidUp(opening.recipientAddress, rounds, invoices, opening.index)) return null
  const later = rounds
    .filter((r) => r.index > opening.index && r.status === 'upcoming')
    .sort((a, b) => a.index - b.index)
  const candidate = later.find((r) => isPaidUp(r.recipientAddress, rounds, invoices, opening.index))
  return candidate ? { swapWith: candidate } : null
}

async function applySkipRule(chamaId: string, opening: Round): Promise<void> {
  const db = getDb()
  const rounds = await db.select().from(schema.rounds).where(eq(schema.rounds.chamaId, chamaId))
  const invoices = await db
    .select()
    .from(schema.invoices)
    .where(inArray(schema.invoices.roundId, rounds.map((r) => r.id)))
  const plan = planSkip(opening, rounds, invoices)
  if (!plan) return
  await db
    .update(schema.rounds)
    .set({ recipientAddress: plan.swapWith.recipientAddress, skippedAddress: opening.recipientAddress })
    .where(eq(schema.rounds.id, opening.id))
  await db
    .update(schema.rounds)
    .set({ recipientAddress: opening.recipientAddress })
    .where(eq(schema.rounds.id, plan.swapWith.id))
}

/** Open the earliest due round of each active chama, if none is open. */
export async function openDueRounds(chamaId?: string): Promise<number> {
  const db = getDb()
  const now = new Date()
  const candidates = await db
    .select({ round: schema.rounds, skip: schema.chamas.skipUntilPaidUp })
    .from(schema.rounds)
    .innerJoin(schema.chamas, eq(schema.chamas.id, schema.rounds.chamaId))
    .where(
      and(
        eq(schema.rounds.status, 'upcoming'),
        eq(schema.chamas.status, 'active'),
        lte(schema.rounds.opensAt, now),
        chamaId ? eq(schema.rounds.chamaId, chamaId) : undefined,
      ),
    )
    .orderBy(asc(schema.rounds.chamaId), asc(schema.rounds.index))

  let opened = 0
  const seen = new Set<string>()
  for (const { round, skip } of candidates) {
    if (seen.has(round.chamaId)) continue
    seen.add(round.chamaId)

    const [stillOpen] = await db
      .select({ id: schema.rounds.id })
      .from(schema.rounds)
      .where(and(eq(schema.rounds.chamaId, round.chamaId), eq(schema.rounds.status, 'open')))
      .limit(1)
    if (stillOpen) continue

    if (skip) await applySkipRule(round.chamaId, round)

    const [flipped] = await db
      .update(schema.rounds)
      .set({ status: 'open' })
      .where(and(eq(schema.rounds.id, round.id), eq(schema.rounds.status, 'upcoming')))
      .returning({ id: schema.rounds.id })
    if (flipped) opened += 1
  }
  return opened
}

/** Every non-recipient member's share is delivered. Pure. */
export function isRoundComplete(round: Round, memberAddresses: string[], invoices: Invoice[]): boolean {
  return memberAddresses
    .filter((a) => a !== round.recipientAddress)
    .every((a) => invoices.some((i) => i.roundId === round.id && i.member === a && i.status === 'delivered'))
}

/**
 * Close a round when every share is delivered, then open the next one if its
 * day has come. A conditional update makes racing callers converge.
 */
export async function advanceRoundIfComplete(roundId: string): Promise<boolean> {
  const db = getDb()
  const [round] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, roundId)).limit(1)
  if (!round || round.status !== 'open') return false

  const members = await db
    .select({ address: schema.members.address })
    .from(schema.members)
    .where(eq(schema.members.chamaId, round.chamaId))
  const invoices = await db.select().from(schema.invoices).where(eq(schema.invoices.roundId, round.id))
  if (!isRoundComplete(round, members.map((m) => m.address), invoices)) return false

  const [closed] = await db
    .update(schema.rounds)
    .set({ status: 'complete', completedAt: new Date() })
    .where(and(eq(schema.rounds.id, round.id), eq(schema.rounds.status, 'open')))
    .returning({ id: schema.rounds.id })
  if (!closed) return false

  const [next] = await db
    .select({ id: schema.rounds.id })
    .from(schema.rounds)
    .where(and(eq(schema.rounds.chamaId, round.chamaId), gt(schema.rounds.index, round.index)))
    .limit(1)
  if (!next) {
    await db.update(schema.chamas).set({ status: 'completed' }).where(eq(schema.chamas.id, round.chamaId))
    return true
  }
  await openDueRounds(round.chamaId)
  return true
}

/** Per member: shares delivered on time, late, and currently overdue. Pure. */
export function onTimeRecord(
  address: string,
  rounds: Round[],
  invoices: Invoice[],
  now = new Date(),
): { onTime: number; late: number; overdue: number } {
  let onTime = 0
  let late = 0
  let overdue = 0
  for (const r of rounds) {
    if (r.recipientAddress === address || r.status === 'upcoming') continue
    const inv = invoices.find((i) => i.roundId === r.id && i.member === address)
    if (inv?.status === 'delivered' && inv.deliveredAt) {
      if (inv.deliveredAt.getTime() <= r.dueAt.getTime()) onTime += 1
      else late += 1
    } else if (now.getTime() > r.dueAt.getTime()) {
      overdue += 1
    }
  }
  return { onTime, late, overdue }
}
