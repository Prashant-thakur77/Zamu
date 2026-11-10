'use client'

import { useState } from 'react'
import { useApp } from './app-provider'
import { supportLink } from './pay-sheet'
import { Avatar, Button, Kes, ReceiptSlip, StatusChip, type ChipState } from './ui'
import { ZamuRing, type Seat } from './zamu-ring'
import { formatDay } from '@/lib/i18n'
import { buildNudgeMessage, miniAppLink, shareText } from '@/lib/nudge'
import type { ChamaView, InvoiceView, MemberView, RoundView } from '@/lib/views'

export function chipState(inv: InvoiceView | null | undefined, localPaying = false): ChipState {
  if (!inv || inv.status === 'issued' || inv.status === 'expired') return localPaying ? 'paying' : 'unpaid'
  if (inv.status === 'submitted') return 'paying'
  if (inv.status === 'checking') return 'checking'
  if (inv.status === 'delivered') return 'paid'
  return 'failed'
}

function chipLabel(t: ReturnType<typeof useApp>['t'], s: ChipState) {
  return { unpaid: t('chip.notPaid'), paying: t('chip.paying'), checking: t('chip.checking'), paid: t('chip.paid'), failed: t('chip.failed') }[s]
}

const methodWord = { mpesa: 'M-Pesa', lightning: 'Lightning', nim: 'NIM' } as const

/** The open round: ring, recipient, and each member's share. */
export function RoundCard({
  chama,
  round,
  onPay,
  onReceived,
  demo = false,
}: {
  chama: ChamaView
  round: RoundView
  onPay: () => void
  onReceived: (invoiceId: string) => void
  demo?: boolean
}) {
  const { t, lang } = useApp()
  const byAddr = new Map(chama.members.map((m) => [m.address, m]))
  const ordered = [...chama.members].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const recipient = byAddr.get(round.recipient)
  const recipientIndex = Math.max(0, ordered.findIndex((m) => m.address === round.recipient))
  const shareOf = (addr: string) => round.shares.find((s) => s.member === addr)?.invoice ?? null
  const delivered = round.shares.filter((s) => s.invoice?.status === 'delivered').length
  const received = delivered * chama.shareKes
  const youAreRecipient = round.recipient === chama.you
  const mine = shareOf(chama.you)
  const myState = chipState(mine)
  const [nudged, setNudged] = useState<string | null>(null)

  const seats: Seat[] = ordered.map((m) => ({
    id: m.address,
    name: m.name,
    you: m.isYou,
    state:
      m.address === round.recipient
        ? 'recipient'
        : ({ unpaid: 'unpaid', paying: 'paying', checking: 'checking', paid: 'paid', failed: 'failed' } as const)[chipState(shareOf(m.address))],
  }))

  const outstanding = round.shares.filter((s) => s.invoice?.status !== 'delivered').map((s) => byAddr.get(s.member)?.name ?? '')

  return (
    <section className="flex flex-col gap-4" data-testid="round-card">
      <div className="flex items-baseline justify-between px-4">
        <p className="font-mono text-[12.5px] font-semibold tracking-wider text-ink-2 uppercase">
          {t('board.round', { n: round.index })} · {t('board.due', { date: formatDay(round.dueAt, lang) })}
        </p>
        <p className="num font-mono text-[12.5px] text-ink-3">
          {round.index}/{chama.size}
        </p>
      </div>

      <div className="px-6">
        <ZamuRing seats={seats} recipientIndex={recipientIndex} label={`${recipient?.name}: ${received} / ${round.totalKes}`}>
          <span className="text-[10.5px] font-bold tracking-[0.14em] text-ink-3 uppercase">{t('board.pot')}</span>
          <Kes amount={received} className="font-display text-[30px] leading-none font-black tracking-[-0.02em]" />
          <span className="num text-[11.5px] font-semibold text-ink-3">/ KSh {round.totalKes.toLocaleString('en-US')}</span>
        </ZamuRing>
      </div>

      <div className="mx-4 flex items-center gap-3 rounded-[12px] border-2 border-ink bg-sun-bg p-3.5">
        <Avatar name={recipient?.name ?? '?'} state="turn" size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[20px] leading-tight font-extrabold">{recipient?.name}</p>
          <p className="text-[13px] text-ink-2">
            {t('board.receives')} · {methodWord[recipient?.payoutMethod ?? 'mpesa']}{' '}
            <span className="font-mono text-[12.5px]">{recipient?.payoutMasked}</span>
          </p>
        </div>
        {youAreRecipient && (
          <span className="shadow-hard seal shrink-0 rounded-full bg-sun px-2.5 py-1.5 font-display text-[13px] font-black tracking-wide uppercase">
            {t('board.yourTurnBig')}
          </span>
        )}
      </div>

      {round.skipped && (
        <p className="mx-4 rounded-[10px] border-l-4 border-clay bg-clay-bg px-3 py-2 text-[13px]">
          {t('board.skipped', { name: byAddr.get(round.skipped)?.name ?? '' })}
        </p>
      )}

      {youAreRecipient ? (
        <p className="mx-4 text-[15px] text-ink-2">
          {t('board.yourTurnSub', { method: methodWord[recipient?.payoutMethod ?? 'mpesa'] })}{' '}
          <b className="text-ink">{t('board.receivedSoFar', { got: `KSh ${received.toLocaleString('en-US')}`, total: `KSh ${round.totalKes.toLocaleString('en-US')}` })}</b>
        </p>
      ) : (
        <div className="px-4">
          {myState === 'paid' ? (
            <p className="flex items-center gap-2 font-display text-[18px] font-extrabold text-leaf">✓ {t('pay.delivered', { name: recipient?.name ?? '' })}</p>
          ) : (
            <Button onClick={onPay} variant={myState === 'unpaid' ? 'press' : 'paper'} testId="open-pay">
              {myState === 'unpaid' ? t('pay.cta', { amount: `KSh ${chama.shareKes.toLocaleString('en-US')}` }) : chipLabel(t, myState)}
            </Button>
          )}
        </div>
      )}

      <ul className="ruled mx-4 border-y border-rule" data-testid="shares">
        {round.shares.map((s) => {
          const m = byAddr.get(s.member)
          const st = chipState(s.invoice)
          return (
            <li key={s.member} className="py-3" data-testid={`share-${m?.name}`}>
              <div className="flex items-center gap-3">
                <Avatar name={m?.name ?? '?'} state={st === 'paid' ? 'paid' : m?.isYou ? 'you' : 'plain'} size={34} />
                <p className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">
                  {m?.name}
                  {m?.isYou && <span className="ml-1.5 text-[12px] font-bold text-ink-3">(you)</span>}
                </p>
                <StatusChip state={st} label={chipLabel(t, st)} />
              </div>
              {st === 'paid' && s.invoice?.method === 'mpesa' && (
                <div className="mt-2 pl-[46px]">
                  <ReceiptSlip
                    code={s.invoice.receiptCode}
                    amount={s.invoice.kesDelivered ?? s.invoice.kes}
                    to={recipient?.name ?? ''}
                    phone={recipient?.payoutMasked}
                    at={s.invoice.deliveredAt}
                    url={s.invoice.receiptUrl}
                    linkLabel={t('chip.receipt')}
                    animate={demo}
                  />
                </div>
              )}
              {st === 'failed' && (
                <div className="mt-2 pl-[46px] text-[12.5px]">
                  <a href={supportLink(s.invoice?.paymentHash)} className="font-semibold text-clay underline underline-offset-2">
                    {t('chip.contact')}
                  </a>
                  <p className="mt-1 text-ink-3">{t('chip.quote')}:</p>
                  <p className="font-mono break-all text-ink select-all">{s.invoice?.paymentHash}</p>
                </div>
              )}
              {youAreRecipient && s.invoice?.needsRecipientConfirm && s.invoice.nimiqHash && (
                <div className="mt-2 pl-[46px]">
                  <Button variant="sun" onClick={() => onReceived(s.invoice!.id)}>
                    {t('chip.received')}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {outstanding.length > 0 && (
        <div className="px-4">
          <Button
            variant="ghost"
            onClick={async () => {
              const text = buildNudgeMessage({
                chamaName: chama.name,
                shareKes: chama.shareKes,
                recipientName: recipient?.name ?? '',
                dueAt: String(round.dueAt),
                outstanding,
                url: miniAppLink(window.location.origin),
                lang,
              })
              const r = await shareText(text)
              setNudged(r.method === 'clipboard' ? t('board.copied') : null)
            }}
          >
            {t('board.nudge')}
          </Button>
          {nudged && <p className="text-center text-[13px] text-ink-2">{nudged}</p>}
        </div>
      )}
    </section>
  )
}

const BANDS = ['bg-ink text-paper', 'bg-clay text-white', 'bg-[#2f4a3a] text-white', 'bg-sun text-[#1d1712]', 'bg-[#4a3526] text-white', 'bg-[#6b2d2a] text-white']

/** The treasurer's book as folder tabs: one band per round, the recipient's name on the tab. */
export function Ledger({ chama }: { chama: ChamaView }) {
  const { t, lang } = useApp()
  const byAddr = new Map(chama.members.map((m) => [m.address, m]))
  if (chama.rounds.length === 0) return null
  return (
    <section className="px-4" aria-label={t('board.order')}>
      <h2 className="signwrite mb-3 text-[30px]">{t('board.order')}</h2>
      <ol className="flex flex-col">
        {chama.rounds.map((r, i) => {
          const name = byAddr.get(r.recipient)?.name ?? ''
          const delivered = r.shares.filter((s) => s.invoice?.status === 'delivered').length
          const band = r.status === 'open' ? 'bg-sun text-[#1d1712]' : BANDS[i % BANDS.length]
          return (
            <li key={r.id} className={`relative ${i > 0 ? '-mt-2' : ''}`} style={{ zIndex: i }}>
              <div className={`inline-flex items-center gap-2 rounded-t-[12px] px-3.5 pt-1.5 pb-2 text-[15px] font-bold ${band}`} style={{ marginLeft: `${(i % 3) * 18}px` }}>
                {name}
                {byAddr.get(r.recipient)?.isYou && <span className="text-[11px] opacity-80">(you)</span>}
              </div>
              <div className={`-mt-1 flex items-center justify-between rounded-[4px_12px_12px_12px] px-3.5 py-3 ${band} ${r.status === 'upcoming' ? 'opacity-90' : ''}`}>
                <span className="font-mono text-[12px] tracking-wider uppercase">
                  {t('board.round', { n: r.index })} ·{' '}
                  {r.status === 'complete' && r.completedAt
                    ? t('board.closedOn', { date: formatDay(r.completedAt, lang) })
                    : r.status === 'open'
                      ? t('board.due', { date: formatDay(r.dueAt, lang) })
                      : t('board.opens', { date: formatDay(r.opensAt, lang) })}
                </span>
                <span className="num font-mono text-[12px] font-semibold">
                  {r.status === 'complete' ? '✓ ' : ''}
                  {delivered}/{r.shares.length}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function MemberRecords({ chama, agreementFor }: { chama: ChamaView; agreementFor?: (address: string) => string }) {
  const { t } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const ordered = [...chama.members].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  return (
    <section className="px-4">
      <h2 className="signwrite mb-1 text-[30px]">{t('board.members')}</h2>
      <p className="mb-2 text-[14px] font-semibold text-ink-2">{t('board.signed', { n: chama.signedCount, total: chama.members.length })}</p>
      <ul className="ruled border-y border-rule">
        {ordered.map((m: MemberView) => (
          <li key={m.address} className="py-3">
            <div className="flex items-center gap-3">
              <Avatar name={m.name} state={m.isYou ? 'you' : 'plain'} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-semibold">
                  {m.position ? `${m.position}. ` : ''}
                  {m.name}
                </p>
                <p className="text-[12.5px] text-ink-3">
                  {methodWord[m.payoutMethod]} <span className="font-mono">{m.payoutMasked}</span>
                </p>
              </div>
              <div className="text-right text-[12px] leading-tight">
                {chama.status === 'active' || chama.status === 'completed' ? (
                  <>
                    <p className="font-semibold text-ink-2">{t('board.record', { on: m.record.onTime, late: m.record.late })}</p>
                    {m.record.overdue > 0 && <p className="font-bold text-clay">{t('board.overdue', { n: m.record.overdue })}</p>}
                  </>
                ) : (
                  <p className={m.signed ? 'font-bold text-leaf' : 'text-ink-3'}>{m.signed ? '✓ signed' : '…'}</p>
                )}
              </div>
            </div>
            {m.signed && (
              <button type="button" className="mt-1 ml-[46px] text-[12.5px] font-semibold text-ink-2 underline decoration-rule underline-offset-4" onClick={() => setOpen(open === m.address ? null : m.address)}>
                {open === m.address ? t('board.hideAgreement') : t('board.viewAgreement')}
              </button>
            )}
            {open === m.address && <AgreementText address={m.address} chamaId={chama.id} fixed={agreementFor?.(m.address)} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function AgreementText({ address, chamaId, fixed }: { address: string; chamaId: string; fixed?: string }) {
  const [text, setText] = useState<string | null>(fixed ?? null)
  const [loaded, setLoaded] = useState(Boolean(fixed))
  if (!loaded) {
    setLoaded(true)
    void fetch(`/api/chamas/${chamaId}/signed?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((b: { message?: string; publicKey?: string; signature?: string }) =>
        setText(b.message ? `${b.message}\n\n— signed —\npublic key ${b.publicKey}\nsignature ${b.signature}` : null),
      )
      .catch(() => setText(null))
  }
  return <pre className="mt-2 ml-[46px] max-h-72 overflow-auto rounded-[8px] border border-rule bg-card p-3 font-mono text-[11.5px] leading-[1.5] whitespace-pre-wrap text-ink">{text ?? '…'}</pre>
}
