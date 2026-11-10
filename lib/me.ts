import { and, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { onTimeRecord } from './rounds'

/**
 * One member's picture across every chama: what they've paid and received,
 * their on-time record, what they owe next, and when their turns come.
 */
export async function summaryFor(address: string) {
  const db = getDb()
  const memberships = await db
    .select({ chama: schema.chamas, me: schema.members })
    .from(schema.members)
    .innerJoin(schema.chamas, eq(schema.chamas.id, schema.members.chamaId))
    .where(eq(schema.members.address, address))

  const chamaIds = memberships.map((m) => m.chama.id)
  const rounds = chamaIds.length
    ? await db.select().from(schema.rounds).where(inArray(schema.rounds.chamaId, chamaIds))
    : []
  const invoices = rounds.length
    ? await db.select().from(schema.invoices).where(inArray(schema.invoices.roundId, rounds.map((r) => r.id)))
    : []
  const people = chamaIds.length
    ? await db
        .select({ chamaId: schema.members.chamaId, address: schema.members.address, name: schema.members.displayName })
        .from(schema.members)
        .where(inArray(schema.members.chamaId, chamaIds))
    : []
  const nameOf = (chamaId: string, a: string) => people.find((p) => p.chamaId === chamaId && p.address === a)?.name ?? ''

  const delivered = invoices.filter((i) => i.status === 'delivered')
  const paidKes = delivered.filter((i) => i.member === address).reduce((a, i) => a + (i.kesDelivered ?? i.kes), 0)
  const receivedKes = delivered.filter((i) => i.recipientAddress === address).reduce((a, i) => a + (i.kesDelivered ?? i.kes), 0)
  const receipts = delivered.filter((i) => i.member === address || i.recipientAddress === address).length

  const record = { onTime: 0, late: 0, overdue: 0 }
  for (const { chama } of memberships) {
    const r = onTimeRecord(address, rounds.filter((x) => x.chamaId === chama.id), invoices)
    record.onTime += r.onTime
    record.late += r.late
    record.overdue += r.overdue
  }

  const owe = rounds
    .filter((r) => r.status === 'open' && r.recipientAddress !== address)
    .map((r) => {
      const c = memberships.find((m) => m.chama.id === r.chamaId)!.chama
      const inv = invoices.find((i) => i.roundId === r.id && i.member === address)
      return {
        chamaId: c.id,
        chamaName: c.name,
        round: r.index,
        dueAt: r.dueAt,
        kes: c.shareKes,
        to: nameOf(c.id, r.recipientAddress),
        status: inv?.status ?? 'unpaid',
      }
    })
    .filter((x) => x.status !== 'delivered')
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())

  const turns = rounds
    .filter((r) => r.recipientAddress === address && r.status !== 'complete')
    .map((r) => {
      const c = memberships.find((m) => m.chama.id === r.chamaId)!.chama
      const members = people.filter((p) => p.chamaId === c.id).length
      const got = delivered.filter((i) => i.roundId === r.id).length
      return { chamaId: c.id, chamaName: c.name, round: r.index, opensAt: r.opensAt, dueAt: r.dueAt, open: r.status === 'open', potKes: c.shareKes * (members - 1), receivedKes: got * c.shareKes }
    })
    .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())

  const past = rounds
    .filter((r) => r.recipientAddress === address && r.status === 'complete')
    .map((r) => {
      const c = memberships.find((m) => m.chama.id === r.chamaId)!.chama
      return { chamaId: c.id, chamaName: c.name, round: r.index, completedAt: r.completedAt, kes: delivered.filter((i) => i.roundId === r.id).reduce((a, i) => a + (i.kesDelivered ?? i.kes), 0) }
    })

  return {
    address,
    names: [...new Set(memberships.map((m) => m.me.displayName))],
    chamas: { total: memberships.length, active: memberships.filter((m) => m.chama.status === 'active').length },
    paidKes,
    receivedKes,
    receipts,
    record,
    owe,
    turns,
    past,
  }
}

export function reliability(record: { onTime: number; late: number; overdue: number }): number | null {
  const n = record.onTime + record.late + record.overdue
  return n === 0 ? null : Math.round((record.onTime / n) * 100)
}

/** Leave a chama before the order is fixed. The creator cancels instead. */
export async function leaveChama(chamaId: string, address: string) {
  const db = getDb()
  const [chama] = await db.select().from(schema.chamas).where(eq(schema.chamas.id, chamaId)).limit(1)
  const { ZamuError } = await import('./errors')
  if (!chama) throw new ZamuError('Chama not found.', 404)
  if (chama.creatorAddress === address) throw new ZamuError('You started this chama: cancel it instead of leaving.', 409)
  if (chama.status !== 'forming') throw new ZamuError('The order is fixed, so you can no longer leave.', 409)
  const left = await db
    .delete(schema.members)
    .where(and(eq(schema.members.chamaId, chamaId), eq(schema.members.address, address)))
    .returning({ id: schema.members.id })
  if (left.length === 0) throw new ZamuError('You are not a member of this chama.', 403)
}
