'use client'

import Link from 'next/link'
import { useEffect, type ReactNode } from 'react'
import { useApp } from './app-provider'

/** The mark: a ring of seats, one of them lit. */
export function Mark({ size = 28, lit = 0 }: { size?: number; lit?: number }) {
  const seats = 8
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {Array.from({ length: seats }, (_, i) => {
        const a = (i / seats) * Math.PI * 2 - Math.PI / 2
        const on = i === lit
        return <circle key={i} cx={16 + Math.cos(a) * 11} cy={16 + Math.sin(a) * 11} r={on ? 4.2 : 2.6} fill={on ? 'var(--sun)' : 'currentColor'} />
      })}
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <Mark size={26} />
      <span className="font-display text-[26px] leading-none font-extrabold tracking-[-0.04em]">zamu</span>
    </span>
  )
}

/** The kanga hem, with its proverb panel. */
export function KangaBand({ proverb }: { proverb?: string }) {
  return (
    <div aria-hidden={!proverb} className="relative">
      <div className="kanga-band h-[14px] w-full" />
      {proverb && (
        <p className="bg-ink px-4 py-2 text-center font-display text-[13px] font-semibold tracking-wide text-paper italic">
          {proverb}
        </p>
      )}
      <div className="kanga-band h-[14px] w-full" />
    </div>
  )
}

export function TopBar({ back }: { back?: string }) {
  const { t, lang, setLang, session, signOut } = useApp()
  return (
    <header className="flex items-center justify-between px-4 pt-3 pb-2">
      {back ? (
        <Link href={back} className="-ml-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-[15px] font-semibold text-ink-2">
          <span aria-hidden>←</span> {t('form.back')}
        </Link>
      ) : (
        <Link href="/" aria-label="Zamu home" className="min-h-11 py-2">
          <Wordmark />
        </Link>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
          className="min-h-11 rounded-md px-3 text-[14px] font-semibold text-ink-2 underline decoration-rule decoration-2 underline-offset-4"
        >
          {t('app.lang')}
        </button>
        {session && !back && (
          <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-md px-2 text-[14px] text-ink-3">
            {t('app.signOut')}
          </button>
        )}
      </div>
    </header>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`spinner inline-block h-[1.05em] w-[1.05em] rounded-full border-[2.5px] border-current border-r-transparent align-[-0.15em] ${className}`}
    />
  )
}

export function Button({
  children,
  onClick,
  variant = 'press',
  disabled,
  busy,
  type = 'button',
  href,
  testId,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'press' | 'paper' | 'sun' | 'ghost'
  disabled?: boolean
  busy?: boolean
  type?: 'button' | 'submit'
  href?: string
  testId?: string
}) {
  const styles = {
    press: 'bg-press text-press-ink shadow-[0_3px_0_0_var(--ink-3)] active:translate-y-[3px] active:shadow-none',
    sun: 'bg-sun text-[#1d1712] shadow-[0_3px_0_0_#9a6b05] active:translate-y-[3px] active:shadow-none',
    paper: 'bg-card text-ink border-2 border-ink active:translate-y-[2px]',
    ghost: 'text-ink-2 underline decoration-rule decoration-2 underline-offset-4',
  }[variant]
  const cls = `flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[10px] px-5 text-[17px] font-bold transition-transform duration-[var(--t-snap)] ease-[var(--ease-firm)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:translate-y-0 ${styles}`
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} data-testid={testId}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={cls} data-testid={testId} aria-busy={busy || undefined}>
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      {children}
      {error ? <span className="text-[13px] font-medium text-clay">{error}</span> : hint ? <span className="text-[13px] text-ink-3">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full rounded-[10px] border-2 border-rule bg-card px-4 py-3 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink'

export function Notice({ children, tone = 'clay', action }: { children: ReactNode; tone?: 'clay' | 'sun' | 'leaf' | 'plain'; action?: ReactNode }) {
  const tones = {
    clay: 'border-clay bg-clay-bg text-ink',
    sun: 'border-sun bg-sun-bg text-ink',
    leaf: 'border-leaf bg-leaf-bg text-ink',
    plain: 'border-rule bg-card text-ink',
  }[tone]
  return (
    <div role={tone === 'clay' ? 'alert' : 'status'} className={`anim-slip rounded-[10px] border-l-4 px-4 py-3 text-[14px] leading-snug ${tones}`}>
      {children}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Kes({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      <span className="mr-[0.18em] text-[0.46em] font-bold tracking-wide normal-case align-[0.62em]">KSh</span>
      {Math.round(amount).toLocaleString('en-US')}
    </span>
  )
}

export type ChipState = 'unpaid' | 'paying' | 'checking' | 'paid' | 'failed'

export function StatusChip({ state, label }: { state: ChipState; label: string }) {
  const styles: Record<ChipState, string> = {
    unpaid: 'border-rule text-ink-3 bg-transparent',
    paying: 'border-ink text-ink bg-card',
    checking: 'border-sun text-ink bg-sun-bg',
    paid: 'border-leaf text-leaf bg-leaf-bg',
    failed: 'border-clay text-clay bg-clay-bg',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-[3px] text-[12.5px] font-bold whitespace-nowrap ${styles[state]}`}>
      {(state === 'paying' || state === 'checking') && <Spinner className="h-[0.85em] w-[0.85em] border-2" />}
      {state === 'paid' && <span aria-hidden>✓</span>}
      {state === 'failed' && <span aria-hidden>!</span>}
      {label}
    </span>
  )
}

/** A bottom sheet. Escape and the backdrop close it. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Dismiss" tabIndex={-1} onClick={onClose} className="anim-fade absolute inset-0 bg-[#1d1712]/55" />
      <div className="anim-sheet relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[18px] bg-paper pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="kanga-band h-[10px] rounded-t-[18px]" />
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-rule" />
        {children}
      </div>
    </div>
  )
}

/**
 * An M-Pesa receipt, set like the confirmation SMS everyone in Kenya trusts:
 * code first, amount, who, when.
 */
export function ReceiptSlip({
  code,
  amount,
  to,
  phone,
  at,
  url,
  linkLabel,
  animate = true,
}: {
  code: string | null
  amount: number
  to: string
  phone?: string | null
  at?: string | Date | null
  url?: string | null
  linkLabel?: string
  animate?: boolean
}) {
  const when = at ? new Date(at) : null
  return (
    <div className={`relative overflow-hidden rounded-[10px] border-[1.5px] border-leaf bg-card ${animate ? 'anim-print' : ''}`}>
      <div className="flex items-center justify-between bg-leaf px-3 py-1.5 text-[12px] font-bold tracking-wide text-white">
        <span>M-PESA</span>
        <span className="font-mono">{code ?? '········'}</span>
      </div>
      <p className="px-3 pt-2.5 pb-9 font-mono text-[12.5px] leading-[1.55] text-ink">
        <b>{code ?? 'Receipt pending'}</b> Confirmed. Ksh{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} sent to{' '}
        {to.toUpperCase()}
        {phone ? ` ${phone}` : ''}
        {when ? ` on ${when.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })} at ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}.
      </p>
      <span
        aria-hidden
        className={`pointer-events-none absolute right-3 bottom-2 rounded-md border-[2.5px] border-leaf-bright px-2 py-0.5 font-display text-[15px] font-extrabold tracking-wider text-leaf-bright ${animate ? 'anim-stamp' : '-rotate-[8deg]'}`}
        style={animate ? { animationDelay: '520ms' } : undefined}
      >
        PAID
      </span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="block border-t border-rule px-3 py-2 text-[13px] font-semibold text-leaf underline underline-offset-2">
          {linkLabel} ↗
        </a>
      )}
    </div>
  )
}

export function Avatar({ name, state = 'plain', size = 36 }: { name: string; state?: 'plain' | 'turn' | 'paid' | 'you'; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const styles = {
    plain: 'bg-paper-2 text-ink border-rule',
    turn: 'bg-sun text-[#1d1712] border-[#1d1712]',
    paid: 'bg-leaf-bg text-leaf border-leaf',
    you: 'bg-ink text-paper border-ink',
  }[state]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] font-display font-bold ${styles}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
