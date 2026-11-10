'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { Ledger, MemberRecords, RoundCard } from '@/components/board'
import { PaySheet, type PayTarget } from '@/components/pay-sheet'
import { Activity, MyMembership, Receipts, Tabs, type TabId } from '@/components/chama-tabs'
import { InviteExtras } from '@/components/invite-qr'
import { SignInGate } from '@/components/signin-gate'
import { Avatar, Button, KangaBand, Kes, Notice, Spinner, TopBar } from '@/components/ui'
import { api } from '@/lib/client/api'
import { errorType, getWallet } from '@/lib/client/nimiq'
import { useLiveVersion } from '@/lib/client/use-live'
import { buildInviteMessage, miniAppLink, shareText } from '@/lib/nudge'
import type { ChamaView } from '@/lib/views'

export default function ChamaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back="/" />
      <SignInGate>
        <Board id={id} />
      </SignInGate>
    </main>
  )
}

function Board({ id }: { id: string }) {
  const { t } = useApp()
  const [chama, setChama] = useState<ChamaView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<PayTarget | null>(null)
  const [tab, setTab] = useState<TabId>('round')

  const load = useCallback(async () => {
    try {
      setChama(await api.chama(id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('err.generic'))
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])
  useLiveVersion({ fetchVersion: () => api.version(id), enabled: Boolean(chama), onChange: load })

  if (error && !chama)
    return (
      <div className="px-4 py-6">
        <Notice action={<Button variant="paper" onClick={() => void load()}>{t('common.retry')}</Button>}>{error}</Notice>
      </div>
    )
  if (!chama)
    return (
      <p className="flex items-center gap-2 px-4 py-6 text-ink-3">
        <Spinner /> {t('common.loading')}
      </p>
    )

  const open = chama.rounds.find((r) => r.status === 'open')
  // The sheet keeps the round it was opened for, so the last payer still sees
  // their receipt after their share closes the round.
  const payRound = payFor ? chama.rounds.find((r) => r.id === payFor.roundId) : null
  const mine = payRound?.shares.find((s) => s.member === chama.you)?.invoice ?? null
  const openPay = () => {
    if (!open) return
    const recipient = chama.members.find((m) => m.address === open.recipient)
    if (!recipient) return
    setPayFor({ roundId: open.id, recipientName: recipient.name, recipientMasked: recipient.payoutMasked, method: recipient.payoutMethod, kes: chama.shareKes })
  }

  return (
    <div className="flex flex-col gap-8 pb-0">
      <header className="px-4">
        <h1 className="signwrite text-[clamp(40px,12vw,56px)] break-words">{chama.name}</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          <Kes amount={chama.shareKes} className="font-display text-[20px] font-black text-ink" /> {t(`freq.${chama.frequency}`)} ·{' '}
          <span className="font-mono text-[13px] tracking-widest">{chama.inviteCode}</span>
        </p>
        {chama.skipUntilPaidUp && <p className="mt-1 text-[12.5px] text-ink-3">{t('form.rule')}</p>}
        {chama.status !== 'forming' && (
          <button type="button" onClick={() => setTab('members')} data-testid="signed-header"
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[13px] font-bold ${chama.signedCount === chama.members.length ? 'border-leaf bg-leaf-bg text-leaf' : 'border-ink text-ink'}`}>
            {chama.signedCount === chama.members.length ? '✓ ' : ''}{t('board.signed', { n: chama.signedCount, total: chama.members.length })}
          </button>
        )}
      </header>

      {chama.status === 'forming' && (
        <>
          <Forming chama={chama} onChange={load} />
          <MyMembership chama={chama} onChange={load} />
        </>
      )}
      {chama.status !== 'forming' && <Tabs value={tab} onChange={setTab} show={['round', 'receipts', 'members', 'activity']} />}
      {chama.status !== 'forming' && tab === 'round' && (
        <>
      {chama.status === 'signing' && <Signing chama={chama} onChange={load} />}
      {chama.status === 'cancelled' && (
        <div className="px-4">
          <Notice tone="plain">{t('app.cancelled')}</Notice>
        </div>
      )}
      {chama.status === 'completed' && (
        <div className="px-4">
          <Notice tone="leaf">{t('board.complete')}</Notice>
        </div>
      )}
      {chama.status === 'active' && open && (
        <RoundCard
          chama={chama}
          round={open}
          onPay={openPay}
          onReceived={async (invoiceId) => {
            await api.received(invoiceId).catch(() => {})
            void load()
          }}
        />
      )}
      {chama.status === 'active' && !open && (
        <div className="px-4">
          <Notice tone="plain">{t('board.everyone')}</Notice>
        </div>
      )}

          <Ledger chama={chama} />
        </>
      )}
      {tab === 'receipts' && chama.status !== 'forming' && <Receipts chama={chama} />}
      {tab === 'members' && chama.status !== 'forming' && <MemberRecords chama={chama} />}
      {tab === 'activity' && chama.status !== 'forming' && <Activity chama={chama} />}

      {payFor && <PaySheet key={payFor.roundId} open onClose={() => setPayFor(null)} target={payFor} existing={mine} onChanged={load} />}
      <KangaBand />
    </div>
  )
}

function Forming({ chama, onChange }: { chama: ChamaView; onChange: () => void }) {
  const { t, lang } = useApp()
  const isCreator = chama.creator === chama.you
  const [order, setOrder] = useState(chama.members.map((m) => m.address))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setOrder((cur) => {
      const all = chama.members.map((m) => m.address)
      return [...cur.filter((a) => all.includes(a)), ...all.filter((a) => !cur.includes(a))]
    })
  }, [chama.members])

  const byAddr = new Map(chama.members.map((m) => [m.address, m]))
  const creator = byAddr.get(chama.creator)
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const n = [...o]
      const j = i + d
      if (j < 0 || j >= n.length) return o
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })

  return (
    <>
      <section className="mx-4 rounded-[14px] bg-ink p-5 text-paper">
        <p className="text-[13px] font-bold tracking-[0.14em] uppercase opacity-70">{t('board.invite')}</p>
        <p className="mt-2 font-mono text-[44px] leading-none font-semibold tracking-[0.18em]" data-testid="invite-code">
          {chama.inviteCode}
        </p>
        <p className="mt-3 text-[14px] leading-snug opacity-80">{t('board.inviteHint')}</p>
        <div className="mt-4">
          <Button
            variant="sun"
            onClick={async () => {
              const text = buildInviteMessage({
                chamaName: chama.name,
                shareKes: chama.shareKes,
                frequency: t(`freq.${chama.frequency}`),
                code: chama.inviteCode,
                link: miniAppLink(window.location.origin),
                lang,
              })
              const r = await shareText(text)
              setMsg(r.method === 'clipboard' ? t('board.copied') : null)
            }}
            testId="share-invite"
          >
            {t('board.share')}
          </Button>
          {msg && <p className="mt-2 text-center text-[13px]">{msg}</p>}
          <InviteExtras code={chama.inviteCode} />
        </div>
      </section>

      <section className="px-4">
        <h2 className="signwrite text-[30px]">{t('board.order')}</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">
          {t('form.spots', { n: chama.members.length, size: chama.size })}. {isCreator ? t('board.orderHint') : t('board.waitCreator', { name: creator?.name ?? '' })}
        </p>
        <ol className="ruled mt-3 border-y border-rule" data-testid="members">
          {order.map((addr, i) => {
            const m = byAddr.get(addr)
            if (!m) return null
            return (
              <li key={addr} className="flex items-center gap-3 py-2.5">
                <span className="num w-6 font-display text-[22px] font-black text-sun">{i + 1}</span>
                <Avatar name={m.name} state={m.isYou ? 'you' : 'plain'} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold">{m.name}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {m.payoutMethod === 'mpesa' ? 'M-Pesa' : m.payoutMethod === 'lightning' ? 'Lightning' : 'NIM'} <span className="font-mono">{m.payoutMasked}</span>
                  </p>
                </div>
                {isCreator && (
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="h-10 w-10 rounded-md border-2 border-rule text-[16px] font-bold disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" aria-label={`Move ${m.name} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="h-10 w-10 rounded-md border-2 border-rule text-[16px] font-bold disabled:opacity-30">
                      ↓
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      {isCreator && (
        <section className="flex flex-col gap-2 px-4">
          {err && <Notice>{err}</Notice>}
          {chama.members.length < 2 && <Notice tone="sun">{t('board.needTwo')}</Notice>}
          <Button
            busy={busy}
            disabled={chama.members.length < 2}
            testId="lock"
            onClick={async () => {
              setBusy(true)
              setErr(null)
              try {
                await api.lock(chama.id, order)
                onChange()
              } catch (e) {
                setErr(e instanceof Error ? e.message : t('err.generic'))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? t('board.locking') : t('board.lock')}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await api.cancel(chama.id).catch(() => {})
              onChange()
            }}
          >
            {t('board.cancel')}
          </Button>
        </section>
      )}
    </>
  )
}

function Signing({ chama, onChange }: { chama: ChamaView; onChange: () => void }) {
  const { t } = useApp()
  const me = chama.members.find((m) => m.isYou)
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (me?.signed) return
    void api
      .agreement(chama.id)
      .then((r) => setText(r.message))
      .catch((e) => setErr(e instanceof Error ? e.message : t('err.generic')))
  }, [chama.id, me?.signed, t])

  const total = chama.members.length
  return (
    <section className="flex flex-col gap-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1" aria-hidden>
          {chama.members.map((m) => (
            <span key={m.address} className={`h-3 w-3 rounded-full border-[1.5px] ${m.signed ? 'border-leaf bg-leaf' : 'border-ink-3'}`} />
          ))}
        </div>
        <p className="text-[15px] font-bold" data-testid="signed-count">
          {t('board.signed', { n: chama.signedCount, total })}
        </p>
      </div>
      {me?.signed ? (
        <Notice tone="leaf">{t('board.youSigned')}</Notice>
      ) : (
        <>
          <h2 className="signwrite text-[30px]">{t('board.signTitle')}</h2>
          <p className="text-[14px] text-ink-2">{t('board.signHint')}</p>
          <pre className="max-h-80 overflow-auto rounded-[10px] border-2 border-ink bg-card p-3.5 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap" data-testid="agreement">
            {text ?? '…'}
          </pre>
          {err && <Notice>{err}</Notice>}
          <Button
            busy={busy}
            disabled={!text}
            testId="sign"
            onClick={async () => {
              if (!text) return
              setBusy(true)
              setErr(null)
              try {
                const wallet = await getWallet()
                if (!wallet) throw new Error(t('app.openInNimiq'))
                const sig = await wallet.sign(text)
                await api.signAgreement(chama.id, sig)
                onChange()
              } catch (e) {
                setErr(errorType(e) === 'PERMISSION_DENIED' ? t('pay.cancelled') : e instanceof Error ? e.message : t('err.generic'))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? t('board.signing') : t('board.sign')}
          </Button>
        </>
      )}
    </section>
  )
}
