'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { emptyPayout, PayoutPicker, toPayoutInput, type PayoutState } from '@/components/payout-picker'
import { SignInGate } from '@/components/signin-gate'
import { Button, Field, inputClass, Kes, Notice, TopBar } from '@/components/ui'
import { api, ApiError } from '@/lib/client/api'

const FREQS = ['daily', 'weekly', 'biweekly', 'monthly'] as const

export default function StartPage() {
  return (
    <Suspense>
      <StartInner />
    </Suspense>
  )
}

function StartInner() {
  const { t } = useApp()
  const router = useRouter()
  const q = useSearchParams()
  const qFreq = q.get('freq') as (typeof FREQS)[number] | null
  const [name, setName] = useState('')
  const [share, setShare] = useState(q.get('share')?.replace(/[^\d]/g, '').slice(0, 5) || '1000')
  const [freq, setFreq] = useState<(typeof FREQS)[number]>(qFreq && FREQS.includes(qFreq) ? qFreq : 'weekly')
  const [size, setSize] = useState(Math.min(30, Math.max(2, Number(q.get('size')) || 6)))
  const [rule, setRule] = useState(true)
  const [you, setYou] = useState('')
  const [payout, setPayout] = useState<PayoutState>(emptyPayout)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)

  const shareKes = Number(share.replace(/[^\d]/g, '')) || 0
  const total = shareKes * Math.max(size - 1, 1)
  const payoutError = error?.code?.startsWith('bad_') && ['bad_phone', 'bad_lightning', 'bad_nim'].includes(error.code) ? error.message : null

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.create({
        name,
        shareKes,
        frequency: freq,
        size,
        skipUntilPaidUp: rule,
        displayName: you,
        payout: toPayoutInput(payout),
        consent: payout.consent,
      })
      router.push(`/c/${res.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? { message: e.message, code: e.code } : { message: t('err.generic') })
      setBusy(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <TopBar back="/" />
      <h1 className="signwrite px-4 pt-2 text-[44px] text-ink">{t('app.start')}</h1>
      <SignInGate>
        <form
          className="flex flex-col gap-5 px-4 pt-4 pb-10"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label={t('form.chamaName')} error={error?.code === 'bad_chama_name' ? error.message : null}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('form.chamaNamePh')} maxLength={48} data-testid="chama-name" />
          </Field>

          <Field label={t('form.share')} hint={t('form.shareHint')} error={error?.code === 'bad_amount' ? error.message : null}>
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-[10px] border-2 border-r-0 border-rule bg-paper-2 px-3 text-[16px] font-bold text-ink-2">KSh</span>
              <input
                className={`${inputClass} num rounded-l-none font-display text-[22px] font-extrabold`}
                inputMode="numeric"
                value={share}
                onChange={(e) => setShare(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                data-testid="share"
              />
            </div>
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-[14px] font-semibold text-ink">{t('form.often')}</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {FREQS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={freq === f}
                  onClick={() => setFreq(f)}
                  className={`min-h-12 rounded-[10px] border-2 text-[15px] font-semibold ${freq === f ? 'border-ink bg-ink text-paper' : 'border-rule text-ink'}`}
                >
                  {t(`freq.${f}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={t('form.size')} hint={<span>{t('form.sizeHint', { total: `KSh ${total.toLocaleString('en-US')}` })}</span>}>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Fewer" onClick={() => setSize((s) => Math.max(2, s - 1))} className="h-12 w-12 rounded-[10px] border-2 border-ink text-[22px] font-bold">
                −
              </button>
              <span className="num w-14 text-center font-display text-[30px] font-black" aria-live="polite" data-testid="size">
                {size}
              </span>
              <button type="button" aria-label="More" onClick={() => setSize((s) => Math.min(30, s + 1))} className="h-12 w-12 rounded-[10px] border-2 border-ink text-[22px] font-bold">
                +
              </button>
              <span className="ml-auto text-right text-[12px] leading-tight text-ink-3">
                {t('board.pot')}
                <br />
                <Kes amount={total} className="font-display text-[20px] font-extrabold text-ink" />
              </span>
            </div>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border-2 border-ink bg-sun-bg p-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" checked={rule} onChange={(e) => setRule(e.target.checked)} data-testid="rule" />
            <span>
              <span className="block text-[14.5px] leading-snug font-semibold text-ink">{t('form.rule')}</span>
              <span className="mt-1 block text-[13px] leading-snug text-ink-2">{t('form.ruleHint')}</span>
            </span>
          </label>

          <Field label={t('form.yourName')} error={error?.code === 'bad_name' ? error.message : null}>
            <input className={inputClass} value={you} onChange={(e) => setYou(e.target.value)} placeholder={t('form.yourNamePh')} maxLength={40} autoComplete="name" data-testid="your-name" />
          </Field>

          <PayoutPicker value={payout} onChange={setPayout} error={payoutError} />

          {error && !payoutError && !['bad_chama_name', 'bad_amount', 'bad_name'].includes(error.code ?? '') && <Notice>{error.message}</Notice>}

          <Button type="submit" busy={busy} disabled={!payout.consent} testId="create">
            {busy ? t('form.creating') : t('form.create')}
          </Button>
        </form>
      </SignInGate>
    </main>
  )
}
