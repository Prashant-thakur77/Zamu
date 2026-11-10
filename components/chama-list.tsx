'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useApp } from './app-provider'
import { Button, Notice, Spinner } from './ui'
import { api, type ChamaListItem } from '@/lib/client/api'
import { formatDay } from '@/lib/i18n'
import { useLiveVersion } from '@/lib/client/use-live'

/** Every chama you are in, ordered by what needs you now. Live-updating. */
export function ChamaList() {
  const { t, lang, session } = useApp()
  const [chamas, setChamas] = useState<ChamaListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setError(null)
      setChamas((await api.list()).chamas)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('err.generic'))
    }
  }, [t])
  useEffect(() => {
    if (session) void load()
  }, [session, load])
  useLiveVersion({ fetchVersion: api.listVersion, enabled: Boolean(session), onChange: load })

  if (error) return <Notice action={<Button variant="paper" onClick={() => void load()}>{t('common.retry')}</Button>}>{error}</Notice>
  if (chamas === null)
    return (
      <p className="mt-3 flex items-center gap-2 text-ink-3">
        <Spinner /> {t('common.loading')}
      </p>
    )
  if (chamas.length === 0) return <p className="mt-3 rounded-[10px] border-2 border-dashed border-rule px-4 py-5 text-[15px] text-ink-2">{t('app.none')}</p>
  return (
    <ul className="ruled mt-2 border-y border-rule" data-testid="chama-list">
      {chamas.map((c) => (
        <li key={c.id}>
          <Link href={`/c/${c.id}`} className="flex items-center gap-3 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[18px] font-bold tracking-[-0.01em]">{c.name}</p>
              <p className="text-[13.5px] text-ink-2">
                <span className="num">KSh {c.shareKes.toLocaleString('en-US')}</span> {t(`freq.${c.frequency}`)}
                {c.openRound && ` · ${t('app.roundOf', { n: c.openRound.index, total: c.size })}`}
              </p>
            </div>
            <ListBadge c={c} t={t} lang={lang} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ListBadge({ c, t, lang }: { c: ChamaListItem; t: ReturnType<typeof useApp>['t']; lang: 'en' | 'sw' }) {
  if (c.youOwe && c.openRound)
    return (
      <span className="shrink-0 rounded-md bg-ink px-2.5 py-1.5 text-right text-[12px] leading-tight font-bold text-paper">
        {t('app.youOwe')}
        <br />
        <span className="font-normal opacity-80">{formatDay(c.openRound.dueAt, lang)}</span>
      </span>
    )
  if (c.openRound?.yourTurn) return <span className="shrink-0 rounded-md bg-sun px-2.5 py-1.5 text-[12px] font-bold text-[#1d1712]">{t('app.yourTurn')}</span>
  const label =
    c.status === 'forming' ? `${t('app.forming')} ${c.memberCount}/${c.size}` : c.status === 'signing' ? `${t('app.waiting')} ${c.signedCount}/${c.memberCount}` : c.status === 'completed' ? t('app.done') : c.status === 'cancelled' ? t('app.cancelled') : c.openRound ? t('app.to', { name: c.openRound.recipientName }) : ''
  return <span className="max-w-[40%] shrink-0 text-right text-[12.5px] font-semibold text-ink-3">{label}</span>
}
