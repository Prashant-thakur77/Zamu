'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { SignInGate } from '@/components/signin-gate'
import { Button, Field, inputClass, Kes, Notice, Spinner, TopBar } from '@/components/ui'
import { api, type Reserve } from '@/lib/client/api'
import { errorType, getWallet } from '@/lib/client/nimiq'
import { formatDay } from '@/lib/i18n'

export default function ReservePage() {
  const { t } = useApp()
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back="/" />
      <h1 className="signwrite px-4 pt-2 text-[44px]">{t('reserve.title')}</h1>
      <p className="px-4 pt-2 text-[15px] leading-snug text-ink-2">{t('reserve.sub')}</p>
      <SignInGate>
        <ReserveInner />
      </SignInGate>
    </main>
  )
}

function ReserveInner() {
  const { t, lang } = useApp()
  const [r, setR] = useState<Reserve | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState<'stake' | 'pause' | 'retire' | 'remove' | null>(null)
  const [msg, setMsg] = useState<{ tone: 'leaf' | 'clay' | 'plain'; text: string } | null>(null)
  const [keep, setKeep] = useState(false)

  const load = useCallback(async () => {
    try {
      const w = await getWallet()
      const [addr] = (await w?.listAccounts().catch(() => [])) ?? []
      setWallet(addr ?? null)
      setR(await api.reserve(addr))
    } catch (e) {
      setMsg({ tone: 'clay', text: e instanceof Error ? e.message : t('err.generic') })
    }
  }, [t])
  useEffect(() => {
    void load()
    try {
      setKeep(localStorage.getItem('zamu.keepStaked') === '1')
    } catch {}
  }, [load])

  const nextShare = r?.nextShares[0]
  const sharesLeft = r?.nextShares.length ?? 0
  const suggestedNim = r?.kesPerNim && nextShare ? Math.ceil((r.nextShares.slice(0, 3).reduce((a, s) => a + s.kes, 0) / r.kesPerNim) * 1.05) : null
  const daysToDue = nextShare ? (new Date(nextShare.dueAt).getTime() - Date.now()) / 86_400_000 : null
  const validator = r?.validator ?? r?.defaultValidator

  async function run(kind: 'stake' | 'pause' | 'retire' | 'remove') {
    setBusy(kind)
    setMsg(null)
    try {
      const w = await getWallet()
      if (!w) throw new Error(t('app.openInNimiq'))
      let hash: string
      let luna: number
      if (kind === 'stake') {
        luna = Math.round(Number(amount) * 1e5)
        if (!(luna > 0)) throw new Error(t('reserve.amount'))
        hash = r?.staker
          ? await w.sendStakeTransaction({ value: luna })
          : await w.sendNewStakerTransaction({ delegation: validator?.address ?? '', value: luna })
      } else if (kind === 'pause') {
        luna = Math.round((r?.activeNim ?? 0) * 1e5)
        hash = await w.sendSetActiveStakeTransaction({ newActiveBalance: 0 })
      } else if (kind === 'retire') {
        luna = Math.round((r?.inactiveNim ?? 0) * 1e5)
        hash = await w.sendRetireStakeTransaction({ retireStake: luna })
      } else {
        luna = Math.round((r?.retiredNim ?? 0) * 1e5)
        hash = await w.sendRemoveStakeTransaction({ value: luna })
      }
      await api.recordStake({ kind: kind === 'pause' ? 'retire' : kind, luna, validator: validator?.address, txHash: typeof hash === 'string' ? hash.slice(0, 200) : undefined }).catch(() => {})
      setMsg({ tone: 'leaf', text: t('reserve.done') })
      setTimeout(() => void load(), 4000)
    } catch (e) {
      const type = errorType(e)
      setMsg({ tone: type === 'PERMISSION_DENIED' ? 'plain' : 'clay', text: type === 'PERMISSION_DENIED' ? t('pay.cancelled') : type === 'UNKNOWN_REQUEST' ? t('pay.update') : e instanceof Error ? e.message : t('err.generic') })
    } finally {
      setBusy(null)
    }
  }

  if (!r)
    return (
      <p className="flex items-center gap-2 px-4 py-6 text-ink-3">
        <Spinner /> {t('common.loading')}
      </p>
    )

  const cells = Math.max(sharesLeft, 3)
  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-10">
      <section className="shadow-hard rounded-[14px] bg-card p-4" data-testid="reserve-meter">
        <p className="font-display text-[20px] font-extrabold">{r.covers > 0 ? t('reserve.covers', { n: r.covers }) : t('reserve.coversNone')}</p>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: Math.min(cells, 12) }, (_, i) => (
            <span key={i} className={`h-8 flex-1 rounded-[4px] border-[1.5px] ${i < r.covers ? 'border-leaf bg-leaf' : 'border-rule bg-paper-2'}`} />
          ))}
        </div>
        <p className="num mt-3 text-[14px] text-ink-2">
          {t('reserve.staked', { nim: r.activeNim.toLocaleString('en-US', { maximumFractionDigits: 2 }) })}
          {r.kesPerNim && (
            <>
              {' '}
              ≈ <Kes amount={r.activeNim * r.kesPerNim} className="font-bold text-ink" /> · {t('reserve.price', { kes: r.kesPerNim.toFixed(4) })}
            </>
          )}
        </p>
        {nextShare ? (
          <p className="mt-1 text-[13px] text-ink-3">
            <Kes amount={nextShare.kes} /> · {t('board.due', { date: formatDay(nextShare.dueAt, lang) })}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-ink-3">{t('reserve.noShares')}</p>
        )}
      </section>

      <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border-2 border-ink bg-sun-bg p-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--ink)]"
          checked={keep}
          onChange={(e) => {
            setKeep(e.target.checked)
            try {
              localStorage.setItem('zamu.keepStaked', e.target.checked ? '1' : '0')
            } catch {}
            if (e.target.checked && suggestedNim && !amount) setAmount(String(suggestedNim))
          }}
          data-testid="keep-staked"
        />
        <span className="text-[15px] font-semibold">{t('reserve.toggle')}</span>
      </label>

      {keep && (
        <section className="flex flex-col gap-3">
          {validator && (
            <div className="rounded-[10px] border-2 border-rule bg-card p-3">
              <p className="text-[12.5px] font-semibold text-ink-3">{t('reserve.validator')}</p>
              <p className="text-[15.5px] font-bold">
                {validator.name} <span className="font-normal text-ink-2">· fee {(validator.fee * 100).toFixed(1)}%</span>
              </p>
              <p className="font-mono text-[11.5px] break-all text-ink-3">{validator.address}</p>
            </div>
          )}
          <Field label={t('reserve.amount')} hint={suggestedNim ? `≈ 3 shares: ${suggestedNim.toLocaleString('en-US')} NIM` : undefined}>
            <input className={`${inputClass} num`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="30000" data-testid="stake-amount" />
          </Field>
          <Button onClick={() => void run('stake')} busy={busy === 'stake'} disabled={!amount || !validator} testId="stake">
            {busy === 'stake' ? t('reserve.staking') : t('reserve.stake')}
          </Button>
        </section>
      )}

      {(r.activeNim > 0 || r.retiredNim > 0 || r.inactiveNim > 0) && (
        <section className="flex flex-col gap-3 rounded-[12px] border-2 border-ink p-4">
          <h2 className="font-display text-[19px] font-extrabold">{t('reserve.unstakeTitle')}</h2>
          {daysToDue !== null && daysToDue < 3 && <Notice tone="sun">{t('reserve.reminder', { date: formatDay(nextShare!.dueAt, lang) })}</Notice>}
          <p className="text-[14px] leading-snug text-ink-2">{t('reserve.unstakeHint')}</p>
          <Button variant="paper" onClick={() => void run('pause')} busy={busy === 'pause'} disabled={r.activeNim <= 0}>
            {t('reserve.pause')}
          </Button>
          <Button variant="paper" onClick={() => void run('retire')} busy={busy === 'retire'} disabled={r.inactiveNim <= 0}>
            {t('reserve.retire')}
          </Button>
          <Button variant="paper" onClick={() => void run('remove')} busy={busy === 'remove'} disabled={r.retiredNim <= 0}>
            {t('reserve.remove')}
          </Button>
        </section>
      )}

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {wallet && <p className="font-mono text-[11px] break-all text-ink-3">{wallet}</p>}
    </div>
  )
}
