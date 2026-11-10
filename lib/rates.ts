import { and, eq, isNull } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { currentMultiplier, PayoutError } from './tando'
import { isMockPayouts } from './payout-fetch'

/**
 * Per-round conversion rates. Fetched once per round and stored, so every
 * member of the round converts at the same published rate.
 */

let priceCache: { kesPerNim: number; at: number } | null = null

/** KES per 1 NIM, from CoinGecko, cached for five minutes. */
export async function kesPerNim(): Promise<number> {
  if (isMockPayouts()) return 0.033
  if (priceCache && Date.now() - priceCache.at < 5 * 60_000) return priceCache.kesPerNim
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=kes', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const body = (await res.json()) as { 'nimiq-2'?: { kes?: number } }
    const price = body['nimiq-2']?.kes
    if (!price || !(price > 0)) throw new Error('no price')
    priceCache = { kesPerNim: price, at: Date.now() }
    return price
  } catch {
    if (priceCache) return priceCache.kesPerNim
    throw new PayoutError('Could not read the NIM price right now. Try again in a minute.', true)
  }
}

export async function roundMsatsPerKes(roundId: string): Promise<number> {
  const db = getDb()
  const [round] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, roundId)).limit(1)
  if (round?.msatsPerKes) return round.msatsPerKes
  const rate = await currentMultiplier()
  await db
    .update(schema.rounds)
    .set({ msatsPerKes: rate })
    .where(and(eq(schema.rounds.id, roundId), isNull(schema.rounds.msatsPerKes)))
  const [fresh] = await db.select({ r: schema.rounds.msatsPerKes }).from(schema.rounds).where(eq(schema.rounds.id, roundId))
  return fresh?.r ?? rate
}

export async function roundLunaPerKes(roundId: string): Promise<number> {
  const db = getDb()
  const [round] = await db.select().from(schema.rounds).where(eq(schema.rounds.id, roundId)).limit(1)
  if (round?.lunaPerKes) return round.lunaPerKes
  const luna = Math.ceil(100_000 / (await kesPerNim()))
  await db
    .update(schema.rounds)
    .set({ lunaPerKes: luna })
    .where(and(eq(schema.rounds.id, roundId), isNull(schema.rounds.lunaPerKes)))
  const [fresh] = await db.select({ r: schema.rounds.lunaPerKes }).from(schema.rounds).where(eq(schema.rounds.id, roundId))
  return fresh?.r ?? luna
}
