'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from './app-provider'
import { Kes } from './ui'
import { formatDay } from '@/lib/i18n'

const SHARES = [200, 500, 1000, 2000, 5000]
const FREQS = ['daily', 'weekly', 'biweekly', 'monthly'] as const
const DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }

/** Try the numbers before starting: what each turn brings, how long a cycle lasts, when your turn lands. */
export function Planner() {
  const { t, lang } = useApp()
  const [members, setMembers] = useState(8)
  const [share, setShare] = useState(1000)
  const [freq, setFreq] = useState<(typeof FREQS)[number]>('weekly')
  const [pos, setPos] = useState(3)
  const p = Math.min(pos, members)
  const pot = share * (members - 1)
  const cycleDays = DAYS[freq] * members
  const span =
    freq === 'daily' ? t('plan.days', { n: members }) : freq === 'monthly' ? t('plan.months', { n: members }) : t('plan.weeks', { n: (cycleDays / 7) | 0 })
  // Dates use the viewer's clock, so they are computed after the page loads (never on the server).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])
  const turnDate = useMemo(() => {
    if (!now) return null
    const d = new Date(now)
    if (freq === 'monthly') d.setMonth(d.getMonth() + (p - 1))
    else d.setDate(d.getDate() + DAYS[freq] * (p - 1))
    return d
  }, [freq, p, now])

  return (
    <section className="px-4 pt-8" aria-labelledby="plan-h">
      <h2 id="plan-h" className="signwrite text-[34px] text-ink">{t('plan.title')}</h2>
      <p className="mt-1 text-[14.5px] text-ink-2">{t('plan.sub')}</p>
      <div className="shadow-hard mt-4 rounded-[14px] bg-card p-4" data-testid="planner">
        <label className="block">
          <span className="flex items-baseline justify-between text-[14px] font-semibold">
            {t('plan.members')} <span className="num font-display text-[22px] font-black" data-testid="plan-members">{members}</span>
          </span>
          <input type="range" min={2} max={30} value={members} onChange={(e) => setMembers(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--ink)]" aria-label={t('plan.members')} />
        </label>
        <div className="mt-3">
          <span className="text-[14px] font-semibold">{t('plan.share')}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup">
            {SHARES.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={share === v} onClick={() => setShare(v)}
                className={`num min-h-10 rounded-full border-2 px-3 text-[14px] font-bold ${share === v ? 'border-ink bg-ink text-paper' : 'border-rule text-ink'}`}>
                {v.toLocaleString('en-US')}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <span className="text-[14px] font-semibold">{t('plan.often')}</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="radiogroup">
            {FREQS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={freq === f} onClick={() => setFreq(f)}
                className={`min-h-10 rounded-[8px] border-2 px-1 text-[12.5px] leading-tight font-semibold ${freq === f ? 'border-ink bg-ink text-paper' : 'border-rule text-ink'}`}>
                {t(`freq.${f}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-[10px] bg-sun-bg p-3 text-center">
          <p className="text-[12px] font-bold tracking-[0.12em] text-ink-2 uppercase">{t('plan.pot')}</p>
          <Kes amount={pot} className="signwrite block text-[52px] text-ink" />
          <p className="text-[13px] text-ink-2">{t('plan.cycle', { span })}</p>
        </div>
        <label className="mt-4 block">
          <span className="flex items-baseline justify-between text-[14px] font-semibold">
            {t('plan.position')} <span className="num font-display text-[22px] font-black">#{p}</span>
          </span>
          <input type="range" min={1} max={members} value={p} onChange={(e) => setPos(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--sun)]" aria-label={t('plan.position')} />
        </label>
        <p className="mt-2 text-[14px] leading-snug text-ink" data-testid="plan-turn">
          {turnDate ? t('plan.yourTurn', { n: p, date: formatDay(turnDate, lang) }) : ''}{' '}
          <span className="text-ink-2">
            {t('plan.even', { total: `KSh ${(share * (members - 1)).toLocaleString('en-US')}`, pot: `KSh ${pot.toLocaleString('en-US')}` })}
          </span>
        </p>
        <Link href={`/start?share=${share}&size=${members}&freq=${freq}`} data-testid="plan-start"
          className="mt-4 flex min-h-[50px] items-center justify-center rounded-[10px] bg-press text-[16px] font-bold text-press-ink shadow-[0_3px_0_0_var(--ink-3)] active:translate-y-[3px] active:shadow-none">
          {t('plan.start')} →
        </Link>
      </div>
    </section>
  )
}
