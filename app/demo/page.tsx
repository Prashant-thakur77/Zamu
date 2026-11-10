'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { Ledger, MemberRecords, RoundCard } from '@/components/board'
import { Button, KangaBand, Kes, ReceiptSlip, Sheet, Spinner, TopBar } from '@/components/ui'
import type { ChamaView, InvoiceView } from '@/lib/views'

/**
 * A demo chama for anyone outside Kenya. Same board as the real thing, sample
 * members and receipts, no money and no server: everything happens in this
 * page's memory.
 */

const PEOPLE = [
  { name: 'Wanjiru', phone: '+254 7•• ••• 412' },
  { name: 'Otieno', phone: '+254 7•• ••• 908' },
  { name: 'Akinyi', phone: '+254 1•• ••• 233' },
  { name: 'Kamau', phone: '+254 7•• ••• 671' },
  { name: 'Njeri', phone: '+254 7•• ••• 155' },
  { name: 'You', phone: '+254 7•• ••• 678' },
]
const SHARE = 1000
const DAY = 86_400_000

function code(seed = String(Math.random())) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return 'TK' + Array.from({ length: 8 }, (_, i) => a[(h >>> (i * 3)) & 31]).join('')
}

function inv(round: number, member: string, status: InvoiceView['status'], at?: Date): InvoiceView {
  return {
    id: `demo-${round}-${member}`,
    roundId: `r${round}`,
    member,
    method: 'mpesa',
    status,
    kes: SHARE,
    sats: 10_620,
    luna: null,
    bolt11: null,
    paymentHash: 'f177587f5e9f02a420a936ef84274988f5156717d3e181ba02a86bf65708c5dc',
    receiptUrl: null,
    receiptCode: status === 'delivered' ? code(`${round}${member}`) : null,
    kesDelivered: status === 'delivered' ? SHARE : null,
    expiresAt: null,
    nimiqHash: status === 'issued' ? null : 'demo',
    swapId: null,
    recipientNim: null,
    memo: null,
    failureReason: null,
    submittedAt: at ?? null,
    deliveredAt: status === 'delivered' ? (at ?? new Date()) : null,
    tappedAt: at ?? new Date(),
    needsRecipientConfirm: false,
  }
}

function build(openIndex: number, paid: Record<string, InvoiceView['status']>): ChamaView {
  const start = new Date(Date.now() - (openIndex - 1) * 7 * DAY - 2 * DAY)
  const addr = (i: number) => `demo:${PEOPLE[i].name}`
  const members = PEOPLE.map((p, i) => ({
    address: addr(i),
    name: p.name,
    position: i + 1,
    payoutMethod: 'mpesa' as const,
    payoutMasked: p.phone,
    payoutFull: null,
    signed: true,
    signedAt: start,
    record: { onTime: Math.max(0, openIndex - 1 - (i === 3 ? 1 : 0)), late: i === 3 ? 1 : 0, overdue: 0 },
    isYou: p.name === 'You',
    isCreator: i === 0,
  }))
  const rounds = PEOPLE.map((p, i) => {
    const index = i + 1
    const opensAt = new Date(start.getTime() + i * 7 * DAY)
    const dueAt = new Date(opensAt.getTime() + 7 * DAY)
    const status = index < openIndex ? 'complete' : index === openIndex ? 'open' : 'upcoming'
    const shares = members
      .filter((m) => m.address !== addr(i))
      .map((m) => ({
        member: m.address,
        invoice:
          status === 'complete'
            ? inv(index, m.address, 'delivered', new Date(opensAt.getTime() + DAY + ((m.position ?? 1) * 3_600_000)))
            : status === 'open' && paid[m.address]
              ? inv(index, m.address, paid[m.address])
              : null,
      }))
    return {
      id: `r${index}`,
      index,
      status: status as 'complete' | 'open' | 'upcoming',
      opensAt,
      dueAt,
      completedAt: status === 'complete' ? new Date(opensAt.getTime() + 2 * DAY) : null,
      recipient: addr(i),
      skipped: null,
      totalKes: SHARE * (PEOPLE.length - 1),
      shares,
    }
  })
  return {
    id: 'demo',
    name: 'Mama Mboga Chama',
    shareKes: SHARE,
    frequency: 'weekly',
    size: PEOPLE.length,
    status: 'active',
    inviteCode: 'DEMO42',
    skipUntilPaidUp: true,
    creator: addr(0),
    startsAt: start,
    lockedAt: start,
    activatedAt: start,
    signedCount: PEOPLE.length,
    members,
    rounds,
    you: addr(5),
  } as unknown as ChamaView
}

export default function DemoPage() {
  // The demo is built from the viewer's clock, so it renders only in the browser.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready)
    return (
      <main className="flex flex-1 flex-col">
        <TopBar back="/" />
      </main>
    )
  return <DemoInner />
}

function DemoInner() {
  const { t } = useApp()
  const [openIndex, setOpenIndex] = useState(3)
  const [paid, setPaid] = useState<Record<string, InvoiceView['status']>>({ 'demo:Wanjiru': 'delivered', 'demo:Kamau': 'delivered' })
  const [sheet, setSheet] = useState(false)
  const [step, setStep] = useState<'idle' | 'getting' | 'wallet' | 'sent' | 'delivered'>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const chama = useMemo(() => build(openIndex, paid), [openIndex, paid])
  const round = chama.rounds.find((r) => r.status === 'open')!
  const recipient = chama.members.find((m) => m.address === round.recipient)!
  const myInvoice = round.shares.find((s) => s.member === chama.you)?.invoice

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Other members pay on their own, a few seconds apart.
  useEffect(() => {
    const pending = round.shares.filter((s) => s.member !== chama.you && !paid[s.member]).map((s) => s.member)
    if (pending.length === 0) return
    const next = pending[0]
    const id = setTimeout(() => {
      setPaid((p) => ({ ...p, [next]: 'submitted' }))
      later(2600, () => setPaid((p) => ({ ...p, [next]: 'delivered' })))
    }, 5200)
    return () => clearTimeout(id)
  }, [round, paid, chama.you, later])

  // Everyone paid: close the round, pass the turn.
  useEffect(() => {
    if (round.shares.every((s) => s.invoice?.status === 'delivered')) {
      const id = setTimeout(() => {
        setOpenIndex((i) => (i % PEOPLE.length) + 1)
        setPaid({})
        setStep('idle')
      }, 3500)
      return () => clearTimeout(id)
    }
  }, [round])

  const pay = () => {
    setStep('getting')
    later(700, () => setStep('wallet'))
    later(2100, () => {
      setStep('sent')
      setPaid((p) => ({ ...p, [chama.you]: 'submitted' }))
    })
    later(5200, () => {
      setStep('delivered')
      setPaid((p) => ({ ...p, [chama.you]: 'delivered' }))
    })
  }

  const agreement = (address: string) => {
    const m = chama.members.find((x) => x.address === address)!
    return [
      'Zamu chama agreement',
      '',
      `Chama: ${chama.name} (${chama.inviteCode})`,
      `Share: KSh 1,000 every week`,
      `Each turn receives: KSh 5,000`,
      'Rule: a member is skipped until they have paid every share due so far',
      '',
      'Rotation:',
      ...chama.members.map((x, i) => `${i + 1}. ${x.name}`),
      '',
      `I am ${m.name}.`,
      'I will pay my share every round I am not receiving.',
      '',
      '(demo: not a real signature)',
    ].join('\n')
  }

  return (
    <main className="flex flex-1 flex-col">
      <TopBar back="/" />
      <div className="mx-4 flex items-center justify-between rounded-[10px] border-2 border-dashed border-ink px-3 py-2">
        <span className="text-[13px] font-bold">{t('demo.badge')}</span>
        <Button variant="ghost" href="/start">
          {t('demo.startReal')}
        </Button>
      </div>
      <header className="px-4 pt-4">
        <h1 className="signwrite text-[clamp(40px,12vw,56px)]">{chama.name}</h1>
        <p className="mt-2 text-[15px] leading-snug text-ink-2">{t('demo.sub')}</p>
      </header>
      <div className="mt-6 flex flex-col gap-8">
        <RoundCard
          chama={chama}
          round={round}
          demo
          onPay={() => {
            setSheet(true)
            if (step === 'delivered') setStep('idle')
          }}
          onReceived={() => {}}
        />
        <Ledger chama={chama} />
        <MemberRecords chama={chama} agreementFor={agreement} />
        <KangaBand proverb="Haba na haba hujaza kibaba." />
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} label={t('pay.title')}>
        <div className="flex flex-col gap-4 px-5 pt-4" data-testid="demo-pay">
          <p className="text-[13px] font-bold tracking-[0.12em] text-ink-3 uppercase">{t('pay.yourShare')}</p>
          <Kes amount={SHARE} className="signwrite -mt-3 block text-[64px]" />
          <p className="-mt-2 text-[15px] font-semibold">
            {t('pay.to', { name: recipient.name })} <span className="ml-1 font-mono text-[13px] font-normal text-ink-2">{recipient.payoutMasked}</span>
          </p>
          {myInvoice?.status === 'delivered' || step === 'delivered' ? (
            <>
              <p className="font-display text-[20px] font-extrabold text-leaf">✓ {t('pay.delivered', { name: recipient.name })}</p>
              <ReceiptSlip code={myInvoice?.receiptCode ?? code()} amount={SHARE} to={recipient.name} phone={recipient.payoutMasked} at={new Date()} />
              <Button variant="paper" onClick={() => setSheet(false)}>
                {t('pay.close')}
              </Button>
            </>
          ) : step === 'sent' ? (
            <div className="flex items-center gap-3 rounded-[10px] border-2 border-ink bg-card p-4">
              <Spinner className="text-[22px]" />
              <span className="text-[15px] font-semibold">{t('pay.sent')}</span>
            </div>
          ) : (
            <>
              <Button onClick={pay} busy={step === 'getting' || step === 'wallet'} disabled={step !== 'idle'} testId="demo-pay-btn">
                {step === 'getting' ? t('pay.getting') : step === 'wallet' ? t('pay.waitingWallet') : t('pay.cta', { amount: 'KSh 1,000' })}
              </Button>
              <p className="text-[13px] leading-snug text-ink-3">{t('pay.how')}</p>
            </>
          )}
        </div>
      </Sheet>
    </main>
  )
}
