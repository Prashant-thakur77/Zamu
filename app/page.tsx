'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { ChamaList } from '@/components/chama-list'
import { Planner } from '@/components/planner'
import { Button, KangaBand, Kes, Notice, Spinner, TopBar } from '@/components/ui'
import { ZamuRing, type Seat } from '@/components/zamu-ring'

const NAMES = ['Wanjiru', 'Otieno', 'Akinyi', 'Kamau', 'Njeri', 'Baraka']
const SHARE = 1000

/** The hero ring plays a chama on its own: shares land, then the turn passes. */
function useAutoChama() {
  const [turn, setTurn] = useState(0)
  const [paid, setPaid] = useState<number[]>([])
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPaid([1, 2, 4])
      return
    }
    let alive = true
    const timer = setInterval(() => {
      if (!alive) return
      setPaid((p) => {
        const remaining = NAMES.map((_, i) => i).filter((i) => i !== turn && !p.includes(i))
        if (remaining.length === 0) {
          setTurn((t) => (t + 1) % NAMES.length)
          return []
        }
        return [...p, remaining[Math.floor(Math.random() * remaining.length)]]
      })
    }, 1300)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [turn])
  const seats: Seat[] = NAMES.map((name, i) => ({
    id: name,
    name,
    state: i === turn ? 'recipient' : paid.includes(i) ? 'paid' : 'unpaid',
  }))
  return { seats, turn, received: paid.length * SHARE }
}

export default function Home() {
  const { t, lang, session, ready, signIn, busy, notice, canSign, network } = useApp()
  const { seats, turn, received } = useAutoChama()

  return (
    <main className="flex flex-1 flex-col">
      <TopBar />
      {network === 'testnet' && (
        <div className="px-4">
          <Notice tone="sun">{t('app.testnet')}</Notice>
        </div>
      )}

      <section className="px-4 pt-3">
        <h1 className="signwrite text-[clamp(50px,15.5vw,70px)] text-ink">{t('app.tagline')}</h1>
        <p className="mt-3 max-w-[36ch] text-[16px] leading-[1.45] text-ink-2">{t('app.sub')}</p>
      </section>

      <section className="mt-2 px-6" aria-hidden="false">
        <ZamuRing seats={seats} recipientIndex={turn} label={`${NAMES[turn]}: ${received} of ${(NAMES.length - 1) * SHARE}`}>
          <span className="text-[11px] font-bold tracking-[0.14em] text-ink-3 uppercase">{t('board.pot')}</span>
          <Kes amount={received} className="font-display text-[34px] leading-none font-extrabold tracking-[-0.03em] text-ink" />
          <span className="mt-1 text-[12.5px] leading-tight font-semibold text-ink-2">
            → {NAMES[turn]} · M-Pesa
          </span>
        </ZamuRing>
      </section>

      <section className="flex flex-col gap-3 px-4 pt-2">
        <Button href="/start" testId="start">
          {t('app.start')}
        </Button>
        <Button href="/join" variant="paper" testId="join">
          {t('app.join')}
        </Button>
        <Link href="/demo" className="mt-1 flex min-h-11 flex-col items-center justify-center text-center" data-testid="demo">
          <span className="text-[16px] font-bold text-ink underline decoration-sun decoration-[3px] underline-offset-4">{t('app.demo')}</span>
          <span className="text-[13px] text-ink-3">{t('app.demoNote')}</span>
        </Link>
      </section>

      <section className="px-4 pt-6">
        {!ready ? (
          <p className="flex items-center gap-2 text-ink-3">
            <Spinner /> {t('common.loading')}
          </p>
        ) : session ? (
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em]">{t('app.yours')}</h2>
              <Link href="/reserve" className="text-[14px] font-semibold text-ink-2 underline decoration-rule decoration-2 underline-offset-4">
                {t('app.reserve')}
              </Link>
            </div>
            <ChamaList />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {canSign ? (
              <>
                <Button variant="paper" onClick={() => void signIn()} busy={busy} testId="signin">
                  {busy ? t('app.signingIn') : t('app.signIn')}
                </Button>
                <p className="text-center text-[13px] text-ink-3">{t('app.signInWhy')}</p>
              </>
            ) : (
              <Notice tone="plain">
                <b>{t('app.openInNimiq')}</b>
                <br />
                {t('app.openInNimiqHow')}
              </Notice>
            )}
            {notice && <Notice>{notice}</Notice>}
          </div>
        )}
      </section>

      <Planner />

      <section className="px-4 pt-10 pb-8">
        <h2 className="signwrite text-[34px] text-ink">{t('app.howTitle')}</h2>
        <ol className="relative mt-6 flex flex-col gap-9">
          <span aria-hidden className="absolute top-0 bottom-6 left-1/2 w-[2px] -translate-x-1/2 bg-ink" />
          {(['app.how1', 'app.how2', 'app.how3'] as const).map((k, i) => (
            <li
              key={k}
              className={`shadow-hard relative rounded-[12px] px-4 pt-7 pb-4 text-[15.5px] leading-snug text-ink ${['bg-sun-bg rotate-[-2deg]', 'bg-card rotate-[1.5deg]', 'bg-leaf-bg rotate-[-1deg]'][i]}`}
            >
              <span className="shadow-hard absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-card font-display text-[19px] font-black">
                {i + 1}
              </span>
              {t(k)}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto">
        <KangaBand proverb={lang === 'sw' ? 'Kidole kimoja hakivunji chawa.' : 'Kidole kimoja hakivunji chawa. One finger cannot crush a louse.'} />
      </footer>
    </main>
  )
}

