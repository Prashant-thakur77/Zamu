import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPaidUp, isRoundComplete, onTimeRecord, planSkip } from '../../lib/rounds'
import { sharesCovered } from '../../lib/stake'
import { buildAgreement } from '../../lib/agreement'
import { buildInviteMessage, buildNudgeMessage, miniAppLink } from '../../lib/nudge'

const day = 86_400_000
const t0 = new Date('2026-11-01T09:00:00Z')

function round(index: number, recipient: string, status: 'upcoming' | 'open' | 'complete') {
  return {
    id: `r${index}`,
    chamaId: 'c',
    index,
    recipientAddress: recipient,
    skippedAddress: null,
    opensAt: new Date(t0.getTime() + (index - 1) * 7 * day),
    dueAt: new Date(t0.getTime() + index * 7 * day),
    status,
    msatsPerKes: null,
    lunaPerKes: null,
    completedAt: null,
  }
}

function inv(roundId: string, member: string, status: 'delivered' | 'issued' | 'submitted', deliveredAt?: Date) {
  return {
    id: `${roundId}-${member}`,
    roundId,
    member,
    method: 'mpesa' as const,
    recipientAddress: '',
    recipientPhone: null,
    recipientLightning: null,
    recipientNim: null,
    kes: 100,
    sats: null,
    msats: null,
    luna: null,
    bolt11: null,
    paymentHash: null,
    receiptUrl: null,
    verifyUrl: null,
    expiresAt: null,
    status,
    nimiqHash: null,
    swapId: null,
    receiptCode: null,
    kesDelivered: null,
    failureReason: null,
    recipientConfirmedAt: null,
    tappedAt: t0,
    submittedAt: null,
    deliveredAt: deliveredAt ?? null,
    lastCheckedAt: null,
    createdAt: t0,
  }
}

const members = ['A', 'B', 'C', 'D']

test('a round completes only when every payer is delivered', () => {
  const r = round(1, 'A', 'open')
  const some = [inv('r1', 'B', 'delivered'), inv('r1', 'C', 'delivered'), inv('r1', 'D', 'submitted')]
  assert.equal(isRoundComplete(r, members, some), false)
  const all = [inv('r1', 'B', 'delivered'), inv('r1', 'C', 'delivered'), inv('r1', 'D', 'delivered')]
  assert.equal(isRoundComplete(r, members, all), true)
  assert.equal(isRoundComplete(r, members, all.slice(0, 2)), false)
})

test('skip-until-paid-up moves an unpaid member behind the next paid-up one', () => {
  const rounds = [round(1, 'A', 'complete'), round(2, 'B', 'upcoming'), round(3, 'C', 'upcoming'), round(4, 'D', 'upcoming')]
  // B never paid A in round 1; C and D did.
  const invoices = [inv('r1', 'C', 'delivered'), inv('r1', 'D', 'delivered')]
  assert.equal(isPaidUp('B', rounds, invoices, 2), false)
  assert.equal(isPaidUp('C', rounds, invoices, 2), true)
  const plan = planSkip(rounds[1], rounds, invoices)
  assert.equal(plan?.swapWith.recipientAddress, 'C')
})

test('no skip when the recipient is paid up', () => {
  const rounds = [round(1, 'A', 'complete'), round(2, 'B', 'upcoming'), round(3, 'C', 'upcoming')]
  const invoices = [inv('r1', 'B', 'delivered'), inv('r1', 'C', 'delivered')]
  assert.equal(planSkip(rounds[1], rounds, invoices), null)
})

test('no skip when nobody later is paid up either', () => {
  const rounds = [round(1, 'A', 'complete'), round(2, 'B', 'upcoming'), round(3, 'C', 'upcoming')]
  assert.equal(planSkip(rounds[1], rounds, []), null)
})

test('counts on-time, late and overdue shares', () => {
  const rounds = [round(1, 'A', 'complete'), round(2, 'B', 'complete'), round(3, 'C', 'open')]
  const invoices = [
    inv('r1', 'D', 'delivered', new Date(rounds[0].dueAt.getTime() - 1000)),
    inv('r2', 'D', 'delivered', new Date(rounds[1].dueAt.getTime() + 1000)),
  ]
  const now = new Date(rounds[2].dueAt.getTime() + 1000)
  assert.deepEqual(onTimeRecord('D', rounds, invoices, now), { onTime: 1, late: 1, overdue: 1 })
})

test('reserve meter counts whole shares covered', () => {
  const shares = [{ kes: 1000 }, { kes: 1000 }, { kes: 1000 }]
  assert.equal(sharesCovered(30_000, 0.0333, shares), 0)
  assert.equal(sharesCovered(70_000, 0.0333, shares), 2)
  assert.equal(sharesCovered(1_000_000, 0.0333, shares), 3)
})

test('agreement text carries the order and only a hash of the payout', () => {
  const text = buildAgreement({
    chamaName: 'Mama Mboga',
    inviteCode: 'ABC234',
    shareKes: 1000,
    frequency: 'weekly',
    skipUntilPaidUp: true,
    order: [
      { name: 'Wanjiru', address: 'NQ01' },
      { name: 'Otieno', address: 'NQ02' },
    ],
    signer: { name: 'Otieno', address: 'NQ02', payoutMethod: 'M-Pesa', payoutDestination: '254712345678' },
    date: new Date('2026-11-10T00:00:00Z'),
  })
  assert.match(text, /1\. Wanjiru/)
  assert.match(text, /2\. Otieno/)
  assert.match(text, /KSh 1,000 every week/)
  assert.match(text, /receives: KSh 1,000/)
  assert.ok(!text.includes('254712345678'))
})

test('invite and nudge messages are WhatsApp friendly', () => {
  const link = miniAppLink('https://zamu.prashantthakur.dev/')
  assert.equal(link, 'zamu.prashantthakur.dev')
  const msg = buildInviteMessage({ chamaName: 'Mama Mboga', shareKes: 1000, frequency: 'every week', code: 'ABC234', link })
  assert.match(msg, /ABC234/)
  assert.match(msg, /Custom URL → zamu\.prashantthakur\.dev/)
  const nudge = buildNudgeMessage({ chamaName: 'X', shareKes: 500, recipientName: 'Wanjiru', dueAt: t0.toISOString(), outstanding: ['Otieno'], url: link })
  assert.match(nudge, /Otieno still owes KSh 500/)
})

test('every English string has a Swahili translation', async () => {
  const { dict } = await import('../../lib/i18n')
  const en = Object.keys(dict.en).sort()
  const sw = Object.keys(dict.sw).sort()
  assert.deepEqual(sw, en)
  for (const k of en) {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    assert.equal(vars((dict.sw as Record<string, string>)[k]), vars((dict.en as Record<string, string>)[k]), k)
  }
})
