'use client'

import { useState } from 'react'
import { useApp } from './app-provider'
import { emptyPayout, PayoutPicker, toPayoutInput, type PayoutState } from './payout-picker'
import { Avatar, Button, Kes, Notice, ReceiptSlip, Sheet } from './ui'
import { api, ApiError } from '@/lib/client/api'
import type { Key } from '@/lib/i18n'
import type { ChamaView } from '@/lib/views'

export type TabId = 'round' | 'receipts' | 'members' | 'activity'

export function Tabs({ value, onChange, show }: { value: TabId; onChange: (t: TabId) => void; show: TabId[] }) {
  const { t } = useApp()
  return (
    <div role="tablist" className="mx-4 grid gap-1 rounded-[12px] border-2 border-ink bg-card p-1" style={{ gridTemplateColumns: `repeat(${show.length}, 1fr)` }}>
      {show.map((id) => (
        <button key={id} role="tab" type="button" aria-selected={value === id} onClick={() => onChange(id)} data-testid={`tab-${id}`}
          className={`min-h-10 rounded-[8px] text-[13.5px] font-bold transition-colors duration-[var(--t-snap)] ${value === id ? 'bg-ink text-paper' : 'text-ink-2'}`}>
          {t(`tab.${id}` as Key)}
        </button>
      ))}
    </div>
  )
}

const method = { mpesa: 'M-Pesa', lightning: 'Lightning', nim: 'NIM' } as const

/** Every delivered share in the chama, newest first, with its M-Pesa receipt. */
export function Receipts({ chama }: { chama: ChamaView }) {
  const { t } = useApp()
  const byAddr = new Map(chama.members.map((m) => [m.address, m]))
  const items = chama.rounds
    .flatMap((r) => r.shares.filter((s) => s.invoice?.status === 'delivered').map((s) => ({ r, s })))
    .sort((a, b) => new Date(b.s.invoice!.deliveredAt ?? 0).getTime() - new Date(a.s.invoice!.deliveredAt ?? 0).getTime())
  const total = items.reduce((a, x) => a + (x.s.invoice!.kesDelivered ?? x.s.invoice!.kes), 0)
  if (items.length === 0) return <p className="mx-4 rounded-[10px] border-2 border-dashed border-rule px-4 py-5 text-[15px] text-ink-2" data-testid="receipts-empty">{t('rc.none')}</p>
  return (
    <section className="flex flex-col gap-4 px-4" data-testid="receipts">
      <p className="text-[14px] font-bold text-ink">{items.length === 1 ? t('rc.total1', { kes: `KSh ${total.toLocaleString('en-US')}` }) : t('rc.total', { n: items.length, kes: `KSh ${total.toLocaleString('en-US')}` })}</p>
      {items.map(({ r, s }) => {
        const inv = s.invoice!
        const payer = byAddr.get(s.member)
        const to = byAddr.get(r.recipient)
        return (
          <div key={inv.id}>
            <div className="mb-1.5 flex items-center gap-2 text-[13.5px]">
              <Avatar name={payer?.name ?? '?'} state="paid" size={26} />
              <b>{payer?.name}</b>
              <span className="text-ink-3">{t('rc.round', { n: r.index, name: to?.name ?? '' })}</span>
            </div>
            {inv.method === 'mpesa' ? (
              <ReceiptSlip code={inv.receiptCode} amount={inv.kesDelivered ?? inv.kes} to={to?.name ?? ''} phone={to?.payoutMasked} at={inv.deliveredAt} url={inv.receiptUrl} linkLabel={t('chip.receipt')} animate={false} />
            ) : (
              <div className="rounded-[10px] border-[1.5px] border-leaf bg-card px-3 py-2.5 text-[13.5px]">
                ✓ {t('rc.other', { method: method[inv.method] })} · <Kes amount={inv.kes} /> · <span className="font-mono text-[12px]">{(inv.paymentHash ?? inv.nimiqHash ?? '').slice(0, 16)}…</span>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** What happened in this chama, newest first, built from the data everyone can already see. */
export function Activity({ chama }: { chama: ChamaView }) {
  const { t, lang } = useApp()
  const name = (a: string) => chama.members.find((m) => m.address === a)?.name ?? '…'
  const kes = (n: number) => `KSh ${n.toLocaleString('en-US')}`
  type Ev = { at: Date; text: string; tone: 'plain' | 'leaf' | 'sun' | 'clay' }
  const ev: Ev[] = []
  const creator = chama.members.find((m) => m.isCreator)
  for (const m of chama.members) {
    if (m.joinedAt) ev.push({ at: new Date(m.joinedAt), text: m.isCreator ? t('act.created', { name: m.name }) : t('act.joined', { name: m.name }), tone: 'plain' })
    if (m.signedAt) ev.push({ at: new Date(m.signedAt), text: t('act.signed', { name: m.name }), tone: 'plain' })
  }
  if (chama.lockedAt) ev.push({ at: new Date(chama.lockedAt), text: t('act.locked'), tone: 'plain' })
  if (chama.activatedAt) ev.push({ at: new Date(chama.activatedAt), text: t('act.started'), tone: 'sun' })
  for (const r of chama.rounds) {
    if (r.skipped) ev.push({ at: new Date(r.opensAt), text: t('act.skipped', { name: name(r.skipped) }), tone: 'clay' })
    for (const s of r.shares) {
      const inv = s.invoice
      if (!inv) continue
      if (inv.submittedAt) ev.push({ at: new Date(inv.submittedAt), text: t('act.paid', { name: name(s.member), kes: kes(inv.kes), to: name(r.recipient) }), tone: 'plain' })
      if (inv.status === 'delivered' && inv.deliveredAt) ev.push({ at: new Date(inv.deliveredAt), text: t('act.delivered', { name: name(s.member), to: name(r.recipient) }), tone: 'leaf' })
      if (inv.status === 'failed') ev.push({ at: new Date(inv.submittedAt ?? inv.tappedAt), text: t('act.failed', { name: name(s.member) }), tone: 'clay' })
    }
    if (r.completedAt) {
      const got = r.shares.reduce((a, s) => a + (s.invoice?.status === 'delivered' ? s.invoice.kesDelivered ?? s.invoice.kes : 0), 0)
      ev.push({ at: new Date(r.completedAt), text: t('act.roundDone', { n: r.index, to: name(r.recipient), kes: kes(got) }), tone: 'sun' })
    }
  }
  ev.sort((a, b) => b.at.getTime() - a.at.getTime())
  void creator
  if (ev.length === 0) return <p className="mx-4 text-[15px] text-ink-2">{t('act.none')}</p>
  const dot = { plain: 'bg-ink-3', leaf: 'bg-leaf', sun: 'bg-sun', clay: 'bg-clay' }
  return (
    <ol className="relative mx-4 flex flex-col gap-4 border-l-2 border-rule pl-5" data-testid="activity">
      {ev.map((e, i) => (
        <li key={i} className="relative">
          <span className={`absolute top-1.5 -left-[27px] h-3 w-3 rounded-full ring-4 ring-paper ${dot[e.tone]}`} />
          <p className="text-[15px] leading-snug text-ink">{e.text}</p>
          <p className="font-mono text-[11.5px] text-ink-3">
            {e.at.toLocaleString(lang === 'sw' ? 'sw-KE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </li>
      ))}
    </ol>
  )
}

/** While the chama is forming: change where your turn is paid, or leave. */
export function MyMembership({ chama, onChange }: { chama: ChamaView; onChange: () => void }) {
  const { t } = useApp()
  const me = chama.members.find((m) => m.isYou)
  const [open, setOpen] = useState(false)
  const [payout, setPayout] = useState<PayoutState>(emptyPayout)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'leaf' | 'clay'; text: string } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  if (!me || chama.status !== 'forming') return null
  return (
    <section className="flex flex-col gap-2 px-4">
      <Button variant="paper" onClick={() => { setPayout({ ...emptyPayout, method: me.payoutMethod, phone: me.payoutMethod === 'mpesa' ? me.payoutFull ?? '' : '', lightning: me.payoutMethod === 'lightning' ? me.payoutFull ?? '' : '', nim: me.payoutMethod === 'nim' ? me.payoutFull ?? '' : '' }); setOpen(true) }} testId="change-payout">
        {t('po.change')}
      </Button>
      {!me.isCreator && !confirmLeave && <Button variant="ghost" onClick={() => setConfirmLeave(true)} testId="leave">{t('leave.btn')}</Button>}
      {confirmLeave && (
        <Notice tone="sun" action={
          <div className="flex gap-2">
            <Button variant="press" busy={busy} testId="leave-yes" onClick={async () => {
              setBusy(true)
              try {
                await fetch(`/api/chamas/${chama.id}/leave`, { method: 'POST' }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error) })
                window.location.href = '/chamas'
              } catch (e) {
                setMsg({ tone: 'clay', text: e instanceof Error ? e.message : t('err.generic') })
                setBusy(false)
              }
            }}>{t('leave.yes')}</Button>
            <Button variant="paper" onClick={() => setConfirmLeave(false)}>{t('pay.close')}</Button>
          </div>
        }>{t('leave.confirm')}</Notice>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Sheet open={open} onClose={() => setOpen(false)} label={t('po.change')}>
        <form className="flex flex-col gap-4 px-5 pt-4" onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await fetch(`/api/chamas/${chama.id}/payout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payout: toPayoutInput(payout), consent: payout.consent }) })
              .then(async (r) => { if (!r.ok) throw new ApiError((await r.json()).error, r.status) })
            setOpen(false)
            setMsg({ tone: 'leaf', text: t('po.saved') })
            onChange()
          } catch (err) {
            setMsg({ tone: 'clay', text: err instanceof Error ? err.message : t('err.generic') })
            setOpen(false)
          } finally {
            setBusy(false)
          }
        }}>
          <p className="signwrite text-[34px]">{t('po.change')}</p>
          <PayoutPicker value={payout} onChange={setPayout} />
          <Button type="submit" busy={busy} disabled={!payout.consent} testId="save-payout">{t('po.save')}</Button>
        </form>
      </Sheet>
    </section>
  )
}

void api
