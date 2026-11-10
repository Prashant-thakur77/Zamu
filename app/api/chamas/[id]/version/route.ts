import { NextResponse } from 'next/server'
import { and, eq, inArray, max, sql } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { requireAddress, route } from '@/lib/api'
import { ZamuError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/** A short change token so clients poll cheaply and refetch only on change. */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  const db = getDb()
  const [me] = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(and(eq(schema.members.chamaId, id), eq(schema.members.address, address)))
  if (!me) throw new ZamuError('You are not a member of this chama.', 403)

  const [chama] = await db.select({ status: schema.chamas.status }).from(schema.chamas).where(eq(schema.chamas.id, id))
  const [m] = await db
    .select({ n: sql<number>`count(*)::int`, s: sql<number>`count(${schema.members.agreementSignedAt})::int` })
    .from(schema.members)
    .where(eq(schema.members.chamaId, id))
  const rounds = await db.select({ id: schema.rounds.id, status: schema.rounds.status, r: schema.rounds.recipientAddress }).from(schema.rounds).where(eq(schema.rounds.chamaId, id))
  const [inv] = rounds.length
    ? await db
        .select({ n: sql<number>`count(*)::int`, t: max(schema.invoices.lastCheckedAt), d: max(schema.invoices.deliveredAt), st: sql<string>`string_agg(${schema.invoices.status}::text, '')` })
        .from(schema.invoices)
        .where(inArray(schema.invoices.roundId, rounds.map((r) => r.id)))
    : [{ n: 0, t: null, d: null, st: '' }]
  const version = [
    chama?.status,
    m.n,
    m.s,
    rounds.map((r) => r.status[0] + r.r.slice(-4)).join(''),
    inv.n,
    inv.d ? new Date(inv.d).getTime() : 0,
    inv.st,
  ].join('|')
  return NextResponse.json({ version })
})
