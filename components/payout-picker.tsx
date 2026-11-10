'use client'

import { useApp } from './app-provider'
import { Field, inputClass } from './ui'
import { getWallet } from '@/lib/client/nimiq'
import type { PayoutInput } from '@/lib/client/api'

export interface PayoutState {
  method: 'mpesa' | 'lightning' | 'nim'
  phone: string
  lightning: string
  nim: string
  consent: boolean
}

export const emptyPayout: PayoutState = { method: 'mpesa', phone: '', lightning: '', nim: '', consent: false }

export function toPayoutInput(p: PayoutState): PayoutInput {
  return p.method === 'mpesa' ? { method: 'mpesa', phone: p.phone } : p.method === 'lightning' ? { method: 'lightning', lightning: p.lightning } : { method: 'nim', nim: p.nim }
}

export function PayoutPicker({ value, onChange, error }: { value: PayoutState; onChange: (v: PayoutState) => void; error?: string | null }) {
  const { t } = useApp()
  const set = (patch: Partial<PayoutState>) => onChange({ ...value, ...patch })
  const options = [
    { id: 'mpesa', label: t('form.mpesa'), hint: t('form.mpesaHint') },
    { id: 'lightning', label: t('form.lightning'), hint: t('form.lightningHint') },
    { id: 'nim', label: t('form.nim'), hint: t('form.nimHint') },
  ] as const

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-[14px] font-semibold text-ink">{t('form.payout')}</legend>
      <div role="radiogroup" className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const on = value.method === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ method: o.id, consent: false })}
              data-testid={`payout-${o.id}`}
              className={`flex min-h-[58px] flex-col items-center justify-center rounded-[10px] border-2 px-1 text-center transition-colors duration-[var(--t-snap)] ${
                on ? (o.id === 'mpesa' ? 'border-leaf bg-leaf-bg' : 'border-ink bg-card') : 'border-rule bg-transparent'
              }`}
            >
              <span className={`text-[15px] font-bold ${on && o.id === 'mpesa' ? 'text-leaf' : 'text-ink'}`}>{o.label}</span>
              <span className="text-[11.5px] text-ink-3">{o.hint}</span>
            </button>
          )
        })}
      </div>

      {value.method === 'mpesa' && (
        <Field label={t('form.phone')} error={error}>
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-[10px] border-2 border-r-0 border-rule bg-paper-2 px-3 text-[16px] font-semibold text-ink-2">🇰🇪</span>
            <input
              className={`${inputClass} rounded-l-none`}
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('form.phonePh')}
              value={value.phone}
              onChange={(e) => set({ phone: e.target.value })}
              data-testid="phone"
            />
          </div>
        </Field>
      )}
      {value.method === 'lightning' && (
        <Field label={t('form.lnaddr')} error={error}>
          <input
            className={inputClass}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t('form.lnaddrPh')}
            value={value.lightning}
            onChange={(e) => set({ lightning: e.target.value })}
            data-testid="lightning"
          />
        </Field>
      )}
      {value.method === 'nim' && (
        <Field label={t('form.nimaddr')} error={error}>
          <input
            className={`${inputClass} font-mono text-[14px]`}
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="NQ.. .... .... ...."
            value={value.nim}
            onChange={(e) => set({ nim: e.target.value })}
            data-testid="nim"
          />
          <button
            type="button"
            className="self-start text-[13.5px] font-semibold text-ink-2 underline decoration-rule decoration-2 underline-offset-4"
            onClick={async () => {
              const w = await getWallet()
              const [addr] = (await w?.listAccounts().catch(() => [])) ?? []
              if (addr) set({ nim: addr })
            }}
          >
            {t('form.useMine')}
          </button>
        </Field>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border-2 border-rule bg-card p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]"
          checked={value.consent}
          onChange={(e) => set({ consent: e.target.checked })}
          data-testid="consent"
        />
        <span className="text-[13.5px] leading-snug text-ink-2">{value.method === 'mpesa' ? t('form.consent') : t('form.consentOther')}</span>
      </label>
    </fieldset>
  )
}
