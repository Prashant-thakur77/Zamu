import { and, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { ZamuError } from './errors'
import { getNimStaker } from './nim-rpc'
import { kesPerNim } from './rates'

/**
 * The staked reserve: NIM a member keeps staked to cover their next shares,
 * earning rewards until pay day. Unstaking takes two transactions: retire,
 * then remove once the unlock delay has passed.
 */

export interface Validator {
  address: string
  name: string
  fee: number
  payoutType: string
  score: number
  logo: string | null
}

const VALIDATORS_URL = 'https://validators-api-main.je-cf9.workers.dev/api/v1/validators'

let cache: { list: Validator[]; at: number } | null = null

export async function listValidators(): Promise<Validator[]> {
  if (cache && Date.now() - cache.at < 30 * 60_000) return cache.list
  try {
    const res = await fetch(VALIDATORS_URL, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    const raw = (await res.json()) as Record<string, unknown>[]
    const list = raw
      .filter((v) => typeof v.address === 'string' && typeof v.name === 'string')
      .map((v) => ({
        address: String(v.address),
        name: String(v.name),
        fee: Number(v.fee ?? 0),
        payoutType: String(v.payoutType ?? 'none'),
        score: Number((v.score as { total?: number } | number | undefined) && typeof v.score === 'object' ? (v.score as { total?: number }).total : v.score) || 0,
        // Logos arrive as large inline images; the reserve screen doesn't show them.
        logo: null,
      }))
      .filter((v) => v.payoutType !== 'none')
      .sort((a, b) => b.score - a.score)
    cache = { list, at: Date.now() }
    return list
  } catch {
    return cache?.list ?? []
  }
}

/** Highest-scoring pool that pays rewards, with a fee of 5% or less. */
export function pickDefaultValidator(list: Validator[]): Validator | null {
  return list.find((v) => v.fee <= 0.05) ?? list[0] ?? null
}

/** Shares this member still owes across every active chama, soonest first. */
export async function upcomingShares(address: string) {
  const db = getDb()
  const mine = await db
    .select({ chama: schema.chamas })
    .from(schema.members)
    .innerJoin(schema.chamas, eq(schema.chamas.id, schema.members.chamaId))
    .where(and(eq(schema.members.address, address), eq(schema.chamas.status, 'active')))
  if (mine.length === 0) return []
  const rounds = await db
    .select()
    .from(schema.rounds)
    .where(inArray(schema.rounds.chamaId, mine.map((m) => m.chama.id)))
  const invoices = await db
    .select()
    .from(schema.invoices)
    .where(and(inArray(schema.invoices.roundId, rounds.map((r) => r.id)), eq(schema.invoices.member, address)))
  return rounds
    .filter((r) => r.status !== 'complete' && r.recipientAddress !== address)
    .filter((r) => invoices.find((i) => i.roundId === r.id)?.status !== 'delivered')
    .map((r) => ({ roundId: r.id, dueAt: r.dueAt, kes: mine.find((m) => m.chama.id === r.chamaId)!.chama.shareKes }))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
}

/** How many upcoming shares a NIM balance covers, at today's price. Pure. */
export function sharesCovered(stakedNim: number, priceKes: number, shares: { kes: number }[]): number {
  let left = stakedNim * priceKes
  let n = 0
  for (const s of shares) {
    if (left + 1e-9 < s.kes) break
    left -= s.kes
    n += 1
  }
  return n
}

export async function reserveStatus(stakerAddress: string, member: string) {
  const [staker, shares, validators] = await Promise.all([
    getNimStaker(stakerAddress).catch(() => null),
    upcomingShares(member),
    listValidators(),
  ])
  let price: number | null = null
  try {
    price = await kesPerNim()
  } catch {
    price = null
  }
  const activeNim = staker ? staker.balance / 1e5 : 0
  const inactiveNim = staker ? staker.inactiveBalance / 1e5 : 0
  const retiredNim = staker ? staker.retiredBalance / 1e5 : 0
  const def = pickDefaultValidator(validators)
  const delegation = staker?.delegation ?? null
  return {
    staker: Boolean(staker),
    delegation,
    validator: validators.find((v) => v.address.replace(/\s/g, '') === delegation?.replace(/\s/g, '')) ?? null,
    defaultValidator: def,
    activeNim,
    inactiveNim,
    retiredNim,
    inactiveFrom: staker?.inactiveFrom ?? null,
    kesPerNim: price,
    nextShares: shares.slice(0, 12).map((s) => ({ dueAt: s.dueAt, kes: s.kes })),
    covers: price ? sharesCovered(activeNim, price, shares) : 0,
  }
}

export async function recordStakeEvent(params: {
  address: string
  kind: 'stake' | 'retire' | 'remove'
  luna: number
  validator?: string | null
  txHash?: string | null
}) {
  if (!Number.isFinite(params.luna) || params.luna <= 0) throw new ZamuError('Enter an amount above zero.')
  await getDb().insert(schema.stakeEvents).values({
    address: params.address,
    kind: params.kind,
    luna: Math.round(params.luna),
    validator: params.validator ?? null,
    txHash: params.txHash ?? null,
  })
}
