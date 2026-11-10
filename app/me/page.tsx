'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { SignInGate } from '@/components/signin-gate'
import { Button, Kes, Notice, Spinner, StatusChip, TopBar } from '@/components/ui'
import { formatDay } from '@/lib/i18n'

interface Summary {
  address: string
  names: string[]
  chamas: { total: number; active: number }
  paidKes: number
  receivedKes: number
  receipts: number
  record: { onTime: number; late: number; overdue: number }
  reliability: number | null
  owe: { chamaId: string; chamaName: string; round: number; dueAt: string; kes: number; to: string; status: string }[]
  turns: { chamaId: string; chamaName: string; round: number; opensAt: string; open: boolean; potKes: number; receivedKes: number }[]
  past: { chamaId: string; chamaName: string; round: number; completedAt: string | null; kes: number }[]
}

export default function MePage() {
  const { t } = useApp()
  return (
    <main className="flex flex-1 flex-col">
      <TopBar />
      <h1 className="signwrite px-4 pt-2 text-[44px]">{t('me.title')}</h1>
      <p className="px-4 pt-1 text-[15px] text-ink-2">{t('me.sub')}</p>
      <SignInGate>
        <MeInner />
      </SignInGate>
    </main>
  )
}

function Stat({ label, children, tone = 'plain' }: { label: string; children: React.ReactNode; tone?: 'plain' | 'leaf' | 'sun' }) {
  const bg = tone === 'leaf' ? 'bg-leaf-bg' : tone === 'sun' ? 'bg-sun-bg' : 'bg-card'
  return (
    <div className={`shadow-hard rounded-[12px] ${bg} p-3`}>
      <p className="text-[12px] font-bold tracking-[0.1em] text-ink-2 uppercase">{label}</p>
      <div className="mt-1 font-display text-[26px] leading-none font-black text-ink">{children}</div>
    </div>
  )
}

function MeInner() {
  const { t, lang, signOut } = useApp()
  const [s, setS] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? t('err.generic'))
      setS(body)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('err.generic'))
    }
  }, [t])
  useEffect(() => {
    void load()
  }, [load])

  if (err) return <div className="px-4 pt-4"><Notice action={<Button variant="paper" onClick={() => void load()}>{t('common.retry')}</Button>}>{err}</Notice></div>
  if (!s) return <p className="flex items-center gap-2 px-4 py-6 text-ink-3"><Spinner /> {t('common.loading')}</p>

  return (
    <div className="flex flex-col gap-7 px-4 pt-4 pb-6" data-testid="me">
      <section className="grid grid-cols-2 gap-3">
        <Stat label={t('me.paid')}><Kes amount={s.paidKes} /></Stat>
        <Stat label={t('me.received')} tone="leaf"><Kes amount={s.receivedKes} /></Stat>
        <Stat label={t('me.reliability')} tone="sun">
          {s.reliability === null ? <span className="text-[15px] font-semibold">{t('me.noRecord')}</span> : <span data-testid="reliability">{s.reliability}%</span>}
        </Stat>
        <Stat label={t('me.receipts')}><span className="num">{s.receipts}</span></Stat>
      </section>
      <p className="-mt-4 text-[13px] text-ink-3">
        {t('me.chamas', { n: s.chamas.total, a: s.chamas.active })} · {t('board.record', { on: s.record.onTime, late: s.record.late })}
        {s.record.overdue > 0 && <span className="font-bold text-clay"> · {t('board.overdue', { n: s.record.overdue })}</span>}
      </p>

      <section>
        <h2 className="signwrite text-[30px]">{t('me.owe')}</h2>
        {s.owe.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-2">{t('me.oweNone')}</p>
        ) : (
          <ul className="ruled mt-2 border-y border-rule" data-testid="me-owe">
            {s.owe.map((o) => (
              <li key={`${o.chamaId}-${o.round}`}>
                <Link href={`/c/${o.chamaId}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold">{o.chamaName}</p>
                    <p className="text-[13px] text-ink-2"><Kes amount={o.kes} /> {t('app.to', { name: o.to })} · {t('board.due', { date: formatDay(o.dueAt, lang) })}</p>
                  </div>
                  {o.status === 'unpaid' || o.status === 'issued' || o.status === 'expired'
                    ? <span className="rounded-md bg-ink px-3 py-1.5 text-[13px] font-bold text-paper">{t('me.payNow')}</span>
                    : <StatusChip state={o.status === 'checking' ? 'checking' : o.status === 'failed' ? 'failed' : 'paying'} label={t(o.status === 'checking' ? 'chip.checking' : o.status === 'failed' ? 'chip.failed' : 'chip.paying')} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="signwrite text-[30px]">{t('me.turns')}</h2>
        {s.turns.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-2">{t('me.turnsNone')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2" data-testid="me-turns">
            {s.turns.map((x) => (
              <li key={`${x.chamaId}-${x.round}`}>
                <Link href={`/c/${x.chamaId}`} className={`flex items-center justify-between rounded-[12px] border-2 border-ink p-3 ${x.open ? 'bg-sun' : 'bg-card'}`}>
                  <div>
                    <p className="text-[16px] font-bold">{x.chamaName}</p>
                    <p className="text-[13px] text-ink-2">
                      {x.open
                        ? t('me.openNow', { got: `KSh ${x.receivedKes.toLocaleString('en-US')}`, pot: `KSh ${x.potKes.toLocaleString('en-US')}` })
                        : t('me.opens', { date: formatDay(x.opensAt, lang) })}
                    </p>
                  </div>
                  <Kes amount={x.potKes} className="font-display text-[22px] font-black" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {s.past.length > 0 && (
        <section>
          <h2 className="signwrite text-[30px]">{t('me.past')}</h2>
          <ul className="ruled mt-2 border-y border-rule">
            {s.past.map((x) => (
              <li key={`${x.chamaId}-${x.round}`} className="flex items-center justify-between py-3 text-[15px]">
                <span>{x.chamaName} · {t('board.round', { n: x.round })}</span>
                <Kes amount={x.kes} className="font-bold text-leaf" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[12px] border-2 border-rule p-3">
        <p className="text-[12.5px] font-semibold text-ink-3">{t('me.account')}</p>
        <p className="font-mono text-[12.5px] break-all text-ink">{s.address}</p>
        <div className="mt-3"><Button variant="ghost" onClick={() => void signOut()}>{t('app.signOut')}</Button></div>
      </section>
    </div>
  )
}
