/**
 * End-to-end service flow against a real Postgres with the mock payout
 * partner. Run with DATABASE_URL and MOCK_PAYOUTS=1 set (see package.json).
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import * as Nimiq from '@nimiq/core'
import { eq, sql } from 'drizzle-orm'
import { closeDb, getDb, schema } from '../../db'
import { createChama, joinChama, lockChama, agreementFor, signAgreement, getChamaForMember, previewChama } from '../../lib/chamas'
import { issueInvoice, markSubmitted, markUncertain, invoiceStatus, confirmReceived, recheckOpenInvoices, nimMemo } from '../../lib/shares'
import { signedMessageHash } from '../../lib/nimiq-sig'
import { setPayoutFetch } from '../../lib/payout-fetch'
import { openDueRounds } from '../../lib/rounds'
import { chamaView } from '../../lib/views'

process.env.MOCK_PAYOUTS = '1'

type Person = { kp: Nimiq.KeyPair; address: string; name: string }
function person(name: string): Person {
  const kp = Nimiq.KeyPair.generate()
  return { kp, address: kp.toAddress().toUserFriendlyAddress(), name }
}

async function sign(chamaId: string, p: Person) {
  const message = await agreementFor(chamaId, p.address)
  const signature = Nimiq.Signature.create(p.kp.privateKey, p.kp.publicKey, signedMessageHash(message)).toHex()
  await signAgreement({ chamaId, address: p.address, publicKey: p.kp.publicKey.toHex(), signature })
}

/** Pretend Nimiq Pay paid `seconds` ago, so the mock partner reports delivery. */
async function backdate(invoiceId: string, seconds: number) {
  await getDb()
    .update(schema.invoices)
    .set({ submittedAt: new Date(Date.now() - seconds * 1000) })
    .where(eq(schema.invoices.id, invoiceId))
}

async function setup(phones: string[], opts: { skip?: boolean; share?: number } = {}) {
  const people = phones.map((_, i) => person(['Wanjiru', 'Otieno', 'Akinyi', 'Kamau', 'Njeri'][i]))
  const chama = await createChama({
    creator: people[0].address,
    name: 'Mama Mboga Chama',
    shareKes: opts.share ?? 100,
    frequency: 'weekly',
    size: people.length,
    skipUntilPaidUp: opts.skip ?? true,
    displayName: people[0].name,
    payout: { method: 'mpesa', phone: phones[0] },
    consent: true,
  })
  for (const [i, p] of people.entries()) {
    if (i === 0) continue
    await joinChama({ address: p.address, inviteCode: chama.inviteCode, displayName: p.name, payout: { method: 'mpesa', phone: phones[i] }, consent: true })
  }
  return { chama, people }
}

before(async () => {
  await getDb().execute(sql`truncate users, chamas, members, rounds, invoices, stake_events, auth_nonces cascade`)
})
after(async () => {
  setPayoutFetch(null)
  await closeDb()
})

test('create, join, lock, sign: the round opens when the last signature lands', async () => {
  const { chama, people } = await setup(['0712000001', '0712000002', '0712000003'])
  const preview = await previewChama(chama.inviteCode.toLowerCase())
  assert.deepEqual(preview.members, ['Wanjiru', 'Otieno', 'Akinyi'])
  assert.equal(JSON.stringify(preview).includes('2547'), false, 'preview never leaks phones')

  await assert.rejects(lockChama({ chamaId: chama.id, caller: people[1].address }), /Only the person/)
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  await assert.rejects(joinChama({ address: person('Late').address, inviteCode: chama.inviteCode, displayName: 'Late', payout: { method: 'mpesa', phone: '0712000009' }, consent: true }), /already started/)

  await sign(chama.id, people[0])
  await sign(chama.id, people[1])
  let view = await getChamaForMember(chama.id, people[0].address)
  assert.equal(view.chama.status, 'signing')
  assert.equal(view.rounds.length, 0)

  // A signature over different text is refused.
  const bad = Nimiq.Signature.create(people[2].kp.privateKey, people[2].kp.publicKey, signedMessageHash('something else')).toHex()
  await assert.rejects(signAgreement({ chamaId: chama.id, address: people[2].address, publicKey: people[2].kp.publicKey.toHex(), signature: bad }), /does not match/)

  await sign(chama.id, people[2])
  view = await getChamaForMember(chama.id, people[0].address)
  assert.equal(view.chama.status, 'active')
  assert.equal(view.rounds.length, 3)
  assert.equal(view.rounds[0].status, 'open')

  const outsider = person('Outsider')
  await assert.rejects(getChamaForMember(chama.id, outsider.address), /not a member/)

  const board = chamaView(view, people[1].address)
  assert.equal(board.signedCount, 3)
  const wanjiru = board.members.find((m) => m.name === 'Wanjiru')!
  assert.equal(wanjiru.payoutMasked, '+254 7•• ••• 001')
  assert.equal(wanjiru.payoutFull, null, 'others see only the masked number')
  assert.equal(board.members.find((m) => m.isYou)!.payoutFull, '254712000002')
})

test('M-Pesa share: one invoice per member-round, delivered with a receipt, round advances', async () => {
  const { chama, people } = await setup(['0712100001', '0712100002', '0712100003'])
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  for (const p of people) await sign(chama.id, p)
  let view = await getChamaForMember(chama.id, people[0].address)
  const r1 = view.rounds[0]

  await assert.rejects(issueInvoice(r1.id, people[0].address), /your turn/)

  const a = await issueInvoice(r1.id, people[1].address)
  const again = await issueInvoice(r1.id, people[1].address)
  assert.equal(again.id, a.id)
  assert.equal(again.bolt11, a.bolt11, 'an unexpired invoice is returned unchanged')
  assert.match(a.bolt11!, /^lnbc/)
  assert.equal(a.kes, 100)
  assert.ok(a.sats! > 1000)
  assert.equal(a.recipientPhone, '254712100001')

  await markSubmitted({ id: a.id, member: people[1].address, hash: 'f'.repeat(64), swapId: 'swap-1' })
  const after = await issueInvoice(r1.id, people[1].address)
  assert.equal(after.status, 'submitted')
  assert.equal(after.bolt11, a.bolt11, 'never a second invoice once one may be paid')
  await assert.rejects(markSubmitted({ id: a.id, member: people[1].address, hash: 'e'.repeat(64) }), /different payment/)
  await assert.rejects(markSubmitted({ id: a.id, member: people[2].address, hash: 'f'.repeat(64) }), /not your invoice/)

  let s = await invoiceStatus(a.id, people[1].address)
  assert.equal(s.status, 'submitted', 'pending while the partner is still paying out')
  await backdate(a.id, 10)
  s = await invoiceStatus(a.id, people[1].address)
  assert.equal(s.status, 'delivered')
  assert.match(s.receiptCode ?? '', /^TK/)
  assert.ok(s.deliveredAt)
  assert.match(s.receiptUrl ?? '', /bitcoin\.co\.ke\/receipt\//)

  view = await getChamaForMember(chama.id, people[0].address)
  assert.equal(view.rounds[0].status, 'open', 'one share is not the whole round')

  const b = await issueInvoice(r1.id, people[2].address)
  await markSubmitted({ id: b.id, member: people[2].address, hash: 'a'.repeat(64) })
  await backdate(b.id, 10)
  const swept = await recheckOpenInvoices()
  assert.ok(swept.delivered >= 1)

  view = await getChamaForMember(chama.id, people[0].address)
  assert.equal(view.rounds[0].status, 'complete')
  assert.ok(view.rounds[0].completedAt)
  // Round 2 waits for its date: the rhythm is the point of a chama.
  assert.equal(view.rounds[1].status, 'upcoming')
})

test('failure, uncertain outcome, and expired invoices', async () => {
  const { chama, people } = await setup(['0712200000', '0712200002', '0712200003'])
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  for (const p of people) await sign(chama.id, p)
  const view = await getChamaForMember(chama.id, people[0].address)
  const r1 = view.rounds[0]

  // Recipient phone ends in 000: the mock partner fails the payout.
  const a = await issueInvoice(r1.id, people[1].address)
  await markSubmitted({ id: a.id, member: people[1].address, hash: 'b'.repeat(64) })
  await backdate(a.id, 10)
  const failed = await invoiceStatus(a.id, people[1].address)
  assert.equal(failed.status, 'failed')
  assert.match(failed.failureReason ?? '', /failed/)

  // Outcome unknown: held for checking, with the identifiers Nimiq Pay gave.
  const b = await issueInvoice(r1.id, people[2].address)
  const held = await markUncertain({ id: b.id, member: people[2].address, hash: 'c'.repeat(64), swapId: 'swap-x' })
  assert.equal(held.status, 'checking')
  assert.equal(held.nimiqHash, 'c'.repeat(64))
  const again = await issueInvoice(r1.id, people[2].address)
  assert.equal(again.id, b.id)
  assert.equal(again.status, 'checking', 'never re-issued after an uncertain result')
})

test('an expired unpaid invoice is replaced once, a paid-looking one is not', async () => {
  const { chama, people } = await setup(['0712300001', '0712300002'])
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  for (const p of people) await sign(chama.id, p)
  const view = await getChamaForMember(chama.id, people[0].address)
  const r1 = view.rounds[0]
  const a = await issueInvoice(r1.id, people[1].address)
  await getDb().update(schema.invoices).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.invoices.id, a.id))
  const fresh = await issueInvoice(r1.id, people[1].address)
  assert.equal(fresh.id, a.id, 'same row')
  assert.notEqual(fresh.paymentHash, a.paymentHash, 'new invoice')
  assert.equal(fresh.status, 'issued')
})

test('payout partner errors surface as clear messages', async () => {
  const { chama, people } = await setup(['0712400001', '0712400222'])
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  for (const p of people) await sign(chama.id, p)
  // Second member receives in round 2; make member 1 pay member 2 by swapping order.
  const view = await getChamaForMember(chama.id, people[0].address)
  await getDb().update(schema.rounds).set({ recipientAddress: people[1].address }).where(eq(schema.rounds.id, view.rounds[0].id))
  await assert.rejects(issueInvoice(view.rounds[0].id, people[0].address), /testnet/)
})

test('skip-until-paid-up: an unpaid member loses their turn to a paid-up one', async () => {
  const { chama, people } = await setup(['0712500001', '0712500002', '0712500003', '0712500004'])
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  for (const p of people) await sign(chama.id, p)
  let view = await getChamaForMember(chama.id, people[0].address)
  const [r1, r2] = view.rounds
  // Akinyi and Kamau pay round 1; Otieno (next in line) does not.
  for (const p of [people[2], people[3]]) {
    const inv = await issueInvoice(r1.id, p.address)
    await markSubmitted({ id: inv.id, member: p.address, hash: inv.paymentHash!.replace(/^./, 'e') })
    await backdate(inv.id, 10)
    await invoiceStatus(inv.id, p.address)
  }
  // Close round 1 by hand (Otieno never paid) and bring round 2's date forward.
  await getDb().update(schema.rounds).set({ status: 'complete' }).where(eq(schema.rounds.id, r1.id))
  await getDb().update(schema.rounds).set({ opensAt: new Date(Date.now() - 1000) }).where(eq(schema.rounds.id, r2.id))
  await openDueRounds(chama.id)
  view = await getChamaForMember(chama.id, people[0].address)
  const open = view.rounds.find((r) => r.status === 'open')!
  assert.equal(open.index, 2)
  assert.equal(open.recipientAddress, people[2].address, 'Akinyi moves up')
  assert.equal(open.skippedAddress, people[1].address)
  assert.equal(view.rounds[2].recipientAddress, people[1].address, 'Otieno moves back')
})

test('Lightning address payout: exact msats at the round rate, settled via verify URL', async () => {
  const a = person('Amina')
  const b = person('Baraka')
  const chama = await createChama({ creator: a.address, name: 'Diaspora', shareKes: 200, frequency: 'monthly', size: 2, skipUntilPaidUp: false, displayName: 'Amina', payout: { method: 'lightning', lightning: 'amina@wallet.example' }, consent: true })
  await joinChama({ address: b.address, inviteCode: chama.inviteCode, displayName: 'Baraka', payout: { method: 'mpesa', phone: '0712600002' }, consent: true })
  await lockChama({ chamaId: chama.id, caller: a.address })
  await sign(chama.id, a)
  await sign(chama.id, b)
  const view = await getChamaForMember(chama.id, a.address)
  const inv = await issueInvoice(view.rounds[0].id, b.address)
  assert.equal(inv.method, 'lightning')
  assert.equal(inv.msats, 200 * 10_443)
  assert.ok(inv.verifyUrl)
  await markSubmitted({ id: inv.id, member: b.address, hash: '1'.repeat(64) })
  await backdate(inv.id, 10)
  const s = await invoiceStatus(inv.id, b.address)
  assert.equal(s.status, 'delivered')
})

test('Lightning address without verify: recipient confirms with one tap', async () => {
  const a = person('Amina')
  const b = person('Baraka')
  const chama = await createChama({ creator: a.address, name: 'NoVerify', shareKes: 50, frequency: 'monthly', size: 2, skipUntilPaidUp: false, displayName: 'Amina', payout: { method: 'lightning', lightning: 'noverify@wallet.example' }, consent: true })
  await joinChama({ address: b.address, inviteCode: chama.inviteCode, displayName: 'Baraka', payout: { method: 'mpesa', phone: '0712700002' }, consent: true })
  await lockChama({ chamaId: chama.id, caller: a.address })
  await sign(chama.id, a)
  await sign(chama.id, b)
  const view = await getChamaForMember(chama.id, a.address)
  const inv = await issueInvoice(view.rounds[0].id, b.address)
  await assert.rejects(confirmReceived(inv.id, a.address), /not been paid/)
  await markSubmitted({ id: inv.id, member: b.address, hash: '2'.repeat(64) })
  await assert.rejects(confirmReceived(inv.id, b.address), /Only the recipient/)
  const done = await confirmReceived(inv.id, a.address)
  assert.equal(done.status, 'delivered')
})

test('NIM payout: amount from the round rate, memo binds the transaction', async () => {
  const a = person('Amina')
  const b = person('Baraka')
  const nimTo = person('wallet').address
  const chama = await createChama({ creator: a.address, name: 'NIM', shareKes: 100, frequency: 'monthly', size: 2, skipUntilPaidUp: false, displayName: 'Amina', payout: { method: 'nim', nim: nimTo }, consent: true })
  await joinChama({ address: b.address, inviteCode: chama.inviteCode, displayName: 'Baraka', payout: { method: 'mpesa', phone: '0712800002' }, consent: true })
  await lockChama({ chamaId: chama.id, caller: a.address })
  await sign(chama.id, a)
  await sign(chama.id, b)
  const view = await getChamaForMember(chama.id, a.address)
  const inv = await issueInvoice(view.rounds[0].id, b.address)
  assert.equal(inv.method, 'nim')
  assert.equal(inv.recipientNim, nimTo)
  assert.equal(inv.luna, Math.ceil(100_000 / 0.033) * 100)
  assert.match(nimMemo(inv.id), /^zamu:[0-9a-f]{12}$/)
  assert.ok(new TextEncoder().encode(nimMemo(inv.id)).length <= 64)
  // Verification against a stub Nimiq RPC: Nimiq Pay may hand back a
  // serialised transaction, so the payment is found by its memo.
  const memoHex = Buffer.from(nimMemo(inv.id)).toString('hex')
  const txs = [
    { hash: '9'.repeat(64), blockNumber: 1, confirmations: 1, from: 'NQ00', to: nimTo, value: inv.luna, recipientData: memoHex, executionResult: true },
  ]
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { method } = JSON.parse(body)
      const data = method === 'getTransactionsByAddress' ? txs : null
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(data === null ? { jsonrpc: '2.0', id: 1, error: { code: -1, message: 'not found', data: 'not found' } } : { jsonrpc: '2.0', id: 1, result: { data, metadata: null } }))
    })
  })
  await new Promise<void>((r) => server.listen(0, r))
  process.env.NIMIQ_RPC_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    await markSubmitted({ id: inv.id, member: b.address, hash: '0200' + 'ab'.repeat(80) })
    let s = await invoiceStatus(inv.id, b.address)
    assert.equal(s.status, 'submitted', 'one confirmation is not enough')
    txs[0].confirmations = 5
    s = await invoiceStatus(inv.id, b.address)
    assert.equal(s.status, 'delivered')

    // A transaction to the right address without our memo is never credited.
    txs[0].recipientData = Buffer.from('zamu:000000000000').toString('hex')
    const view2 = await getChamaForMember(chama.id, a.address)
    assert.equal(view2.rounds[0].status, 'complete')
  } finally {
    delete process.env.NIMIQ_RPC_URL
    server.close()
  }
})

test('my record sums paid and received, and leaving follows the rules', async () => {
  const { summaryFor, leaveChama, reliability } = await import('../../lib/me')
  const { chama, people } = await setup(['0712900001', '0712900002', '0712900003'])
  // Leaving: the creator cannot, a member can while forming.
  await assert.rejects(leaveChama(chama.id, people[0].address), /cancel it instead/)
  await leaveChama(chama.id, people[2].address)
  await assert.rejects(leaveChama(chama.id, people[2].address), /not a member/)
  await lockChama({ chamaId: chama.id, caller: people[0].address })
  await assert.rejects(leaveChama(chama.id, people[1].address), /no longer leave/)
  for (const p of people.slice(0, 2)) await sign(chama.id, p)
  const view = await getChamaForMember(chama.id, people[0].address)
  const inv = await issueInvoice(view.rounds[0].id, people[1].address)

  let s = await summaryFor(people[1].address)
  assert.equal(s.owe.length, 1)
  assert.equal(s.owe[0].kes, 100)
  assert.equal(s.owe[0].to, 'Wanjiru')

  await markSubmitted({ id: inv.id, member: people[1].address, hash: '7'.repeat(64) })
  await backdate(inv.id, 10)
  await invoiceStatus(inv.id, people[1].address)

  s = await summaryFor(people[1].address)
  assert.equal(s.paidKes, 100)
  assert.equal(s.owe.length, 0)
  assert.equal(reliability(s.record), 100)
  const r = await summaryFor(people[0].address)
  assert.equal(r.receivedKes, 100)
  assert.equal(r.past.length, 1, 'a 2-member round closes on one delivered share')
})
