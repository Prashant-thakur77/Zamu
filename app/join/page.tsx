'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useApp } from '@/components/app-provider'
import { emptyPayout, PayoutPicker, toPayoutInput, type PayoutState } from '@/components/payout-picker'
import { SignInGate } from '@/components/signin-gate'
import { Avatar, Button, Field, inputClass, Kes, Notice, TopBar } from '@/components/ui'
import { api, ApiError, type Preview } from '@/lib/client/api'

function JoinInner() {
  const { t } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [you, setYou] = useState('')
  const [payout, setPayout] = useState<PayoutState>(emptyPayout)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)

  async function find(c = code) {
    setError(null)
    setBusy(true)
    try {
      setPreview(await api.preview(c))
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : t('err.generic') })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (code.length === 6) void find(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function join() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.join({ code, displayName: you, payout: toPayoutInput(payout), consent: payout.consent })
      router.push(`/c/${res.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? { message: e.message, code: e.code } : { message: t('err.generic') })
      setBusy(false)
    }
  }

  const payoutError = error?.code && ['bad_phone', 'bad_lightning', 'bad_nim'].includes(error.code) ? error.message : null

  return (
    <main className="flex flex-1 flex-col">
      <TopBar back="/" />
      <h1 className="signwrite px-4 pt-2 text-[44px] text-ink">{t('app.join')}</h1>
      <SignInGate>
        <div className="flex flex-col gap-5 px-4 pt-4 pb-10">
          {!preview ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                void find()
              }}
            >
              <Field label={t('form.code')}>
                <input
                  className={`${inputClass} text-center font-mono text-[28px] font-semibold tracking-[0.3em] uppercase`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder={t('form.codePh')}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  data-testid="code"
                />
              </Field>
              {error && <Notice>{error.message}</Notice>}
              <Button type="submit" busy={busy} disabled={code.length !== 6} testId="find">
                {busy ? t('form.finding') : t('form.find')}
              </Button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault()
                void join()
              }}
            >
              <div className="shadow-hard rounded-[12px] bg-card p-4">
                <p className="font-display text-[24px] leading-tight font-extrabold">{preview.name}</p>
                <p className="mt-1 text-[15px] text-ink-2">
                  <Kes amount={preview.shareKes} className="font-display text-[22px] font-extrabold text-ink" /> {t(`freq.${preview.frequency}`)}
                </p>
                <p className="mt-2 text-[13.5px] text-ink-3">{t('form.spots', { n: preview.members.length, size: preview.size })}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {preview.members.map((m) => (
                    <span key={m} className="flex items-center gap-1.5 rounded-full border border-rule bg-paper py-0.5 pr-2.5 pl-0.5 text-[13px] font-semibold">
                      <Avatar name={m} size={24} /> {m}
                    </span>
                  ))}
                </div>
                {preview.skipUntilPaidUp && <p className="mt-3 border-t border-rule pt-2 text-[12.5px] text-ink-2">{t('form.rule')}</p>}
              </div>
              <Field label={t('form.yourName')} error={error?.code === 'bad_name' ? error.message : null}>
                <input className={inputClass} value={you} onChange={(e) => setYou(e.target.value)} placeholder={t('form.yourNamePh')} maxLength={40} data-testid="your-name" />
              </Field>
              <PayoutPicker value={payout} onChange={setPayout} error={payoutError} />
              {error && !payoutError && error.code !== 'bad_name' && <Notice>{error.message}</Notice>}
              <Button type="submit" busy={busy} disabled={!payout.consent} testId="join-submit">
                {busy ? t('form.joining') : t('form.joinBtn')}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                {t('form.back')}
              </Button>
            </form>
          )}
        </div>
      </SignInGate>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  )
}
