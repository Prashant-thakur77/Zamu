import { sha256Hex } from './lightning'

/**
 * The chama agreement every member signs with their Nimiq key.
 *
 * Built from stored data only, on both client and server, so the server can
 * rebuild the exact text and refuse any signature over something else. The
 * member's own payout destination appears only as a hash: the signed text is
 * shown to the whole group, the number is not.
 */

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

const CADENCE: Record<Frequency, string> = {
  daily: 'every day',
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  monthly: 'every month',
}

export function payoutFingerprint(destination: string): string {
  return sha256Hex(`zamu-payout:${destination}`).slice(0, 16)
}

export function buildAgreement(params: {
  chamaName: string
  inviteCode: string
  shareKes: number
  frequency: Frequency
  skipUntilPaidUp: boolean
  order: { name: string; address: string }[]
  signer: { name: string; address: string; payoutMethod: string; payoutDestination: string }
  date: Date
}): string {
  const { order, signer } = params
  const total = params.shareKes * (order.length - 1)
  const lines = [
    'Zamu chama agreement',
    '',
    `Chama: ${params.chamaName} (${params.inviteCode})`,
    `Share: KSh ${params.shareKes.toLocaleString('en-US')} ${CADENCE[params.frequency]}`,
    `Each turn receives: KSh ${total.toLocaleString('en-US')}`,
    `Rule: ${params.skipUntilPaidUp ? 'a member is skipped until they have paid every share due so far' : 'turns follow the order below'}`,
    '',
    'Rotation:',
    ...order.map((m, i) => `${i + 1}. ${m.name} (${m.address})`),
    '',
    `I am ${signer.name} (${signer.address}).`,
    `I will pay my share every round I am not receiving.`,
    `My payout goes to ${signer.payoutMethod} ${payoutFingerprint(signer.payoutDestination)} (hashed).`,
    `Date: ${params.date.toISOString().slice(0, 10)}`,
  ]
  return lines.join('\n')
}
