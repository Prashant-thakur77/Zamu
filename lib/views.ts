import type { schema } from '@/db'
import { maskPhone } from './phone'
import { onTimeRecord } from './rounds'
import { publicInvoice } from './shares'

type Chama = typeof schema.chamas.$inferSelect
type Member = typeof schema.members.$inferSelect
type Round = typeof schema.rounds.$inferSelect
type Invoice = typeof schema.invoices.$inferSelect

function maskLightning(ln: string): string {
  const [name, domain] = ln.split('@')
  return `${name.slice(0, 2)}•••@${domain}`
}

function maskNim(nim: string): string {
  return `${nim.slice(0, 9)} ••• ${nim.slice(-4)}`
}

/**
 * The board as one member sees it. Only members reach this. Your own payout
 * destination comes back in full; everyone else's is masked.
 */
export function chamaView(params: { chama: Chama; members: Member[]; rounds: Round[]; invoices: Invoice[] }, viewer: string) {
  const { chama, members, rounds, invoices } = params
  const now = new Date()
  const memberOut = members.map((m) => {
    const self = m.address === viewer
    const destination =
      m.payoutMethod === 'mpesa'
        ? m.payoutPhone && (self ? m.payoutPhone : maskPhone(m.payoutPhone))
        : m.payoutMethod === 'lightning'
          ? m.payoutLightning && (self ? m.payoutLightning : maskLightning(m.payoutLightning))
          : m.payoutNim && (self ? m.payoutNim : maskNim(m.payoutNim))
    return {
      address: m.address,
      name: m.displayName,
      position: m.payoutPosition,
      payoutMethod: m.payoutMethod,
      payoutMasked: m.payoutMethod === 'mpesa' && m.payoutPhone ? maskPhone(m.payoutPhone) : destination,
      payoutFull: self ? destination : null,
      signed: Boolean(m.agreementSignedAt),
      signedAt: m.agreementSignedAt,
      record: onTimeRecord(m.address, rounds, invoices, now),
      isYou: self,
      isCreator: m.address === chama.creatorAddress,
      joinedAt: m.joinedAt,
    }
  })

  const roundOut = rounds.map((r) => {
    const payers = members.filter((m) => m.address !== r.recipientAddress)
    return {
      id: r.id,
      index: r.index,
      status: r.status,
      opensAt: r.opensAt,
      dueAt: r.dueAt,
      completedAt: r.completedAt,
      recipient: r.recipientAddress,
      skipped: r.skippedAddress,
      totalKes: chama.shareKes * payers.length,
      shares: payers.map((m) => {
        const inv = invoices.find((i) => i.roundId === r.id && i.member === m.address)
        return { member: m.address, invoice: inv ? publicInvoice(inv) : null }
      }),
    }
  })

  return {
    id: chama.id,
    name: chama.name,
    shareKes: chama.shareKes,
    frequency: chama.frequency,
    size: chama.size,
    status: chama.status,
    inviteCode: chama.inviteCode,
    skipUntilPaidUp: chama.skipUntilPaidUp,
    creator: chama.creatorAddress,
    startsAt: chama.startsAt,
    lockedAt: chama.lockedAt,
    activatedAt: chama.activatedAt,
    signedCount: members.filter((m) => m.agreementSignedAt).length,
    members: memberOut,
    rounds: roundOut,
    you: viewer,
  }
}

export type ChamaView = ReturnType<typeof chamaView>
export type RoundView = ChamaView['rounds'][number]
export type MemberView = ChamaView['members'][number]
export type InvoiceView = NonNullable<RoundView['shares'][number]['invoice']>
