'use client'

import { useState } from 'react'
import { useApp } from '@/components/app-provider'
import { Button, KangaBand, TopBar } from '@/components/ui'
import type { Key } from '@/lib/i18n'

const QS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export default function HelpPage() {
  const { t } = useApp()
  const [open, setOpen] = useState<number | null>(1)
  return (
    <main className="flex flex-1 flex-col">
      <TopBar />
      <h1 className="signwrite px-4 pt-2 text-[44px]">{t('help.title')}</h1>
      <p className="px-4 pt-1 text-[15px] leading-snug text-ink-2">{t('help.sub')}</p>
      <ul className="ruled mx-4 mt-4 border-y border-rule" data-testid="faq">
        {QS.map((n) => {
          const on = open === n
          return (
            <li key={n}>
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : n)}
                className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-[16px] font-bold text-ink">
                {t(`help.q${n}` as Key)}
                <span aria-hidden className={`text-[22px] transition-transform duration-[var(--t-firm)] ${on ? 'rotate-45' : ''}`}>+</span>
              </button>
              {on && <p className="anim-slip pb-4 text-[15px] leading-relaxed text-ink-2">{t(`help.a${n}` as Key)}</p>}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col gap-3 px-4 pt-6 pb-6">
        <Button href="/demo" variant="paper">{t('app.demo')}</Button>
        <p className="text-[13.5px] text-ink-2">{t('help.contact')}</p>
      </div>
      <div className="mt-auto"><KangaBand proverb="Haba na haba hujaza kibaba." /></div>
    </main>
  )
}
