'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from './app-provider'
import { Button, Kes, Notice, ReceiptSlip, Sheet, Spinner } from './ui'
import { api, ApiError } from '@/lib/client/api'
import { errorData, errorType, getWallet, hostNetwork } from '@/lib/client/nimiq'
import type { InvoiceView } from '@/lib/views'

/**
 * Paying one share. The rule this component exists to keep: once Nimiq Pay
 * has returned (or may have returned) a transaction, the Pay button never
 * becomes available again for that invoice.
 */

type Phase =
  | { kind: 'idle' }
  | { kind: 'getting' }
  | { kind: 'wallet' }
  | { kind: 'cancelled' }
  | { kind: 'expired' }
  | { kind: 'update' }
  | { kind: 'error'; message: string }

export interface PayTarget {
  roundId: string
  recipientName: string
  recipientMasked: string | null
  method: 'mpesa' | 'lightning' | 'nim'
  kes: number
}

export function PaySheet({
  open,
  onClose,
  target,
  existing,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  target: PayTarget
  existing: InvoiceView | null
  onChanged: () => void
}) {
  const { t } = useApp()
  const [invoice, setInvoice] = useState<InvoiceView | null>(existing)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const triedFresh = useRef(false)
  const testnet = hostNetwork() === 'testnet' && target.method !== 'nim'

  useEffect(() => {
    if (existing) setInvoice((cur) => (cur && cur.id === existing.id && rank(cur.status) > rank(existing.status) ? cur : existing))
  }, [existing])

  const locked = Boolean(invoice?.nimiqHash) || ['submitted', 'checking', 'delivered', 'failed'].includes(invoice?.status ?? '')

  // Poll every 3 s while the sheet is open and the share is in flight.
  useEffect(() => {
    if (!open || !invoice || !['submitted', 'checking'].includes(invoice.status)) return
    let stop = false
    const tick = async () => {
      try {
        const next = await api.status(invoice.id)
        if (stop) return
        setInvoice(next)
        if (next.status !== invoice.status) onChanged()
      } catch {
        // pending, never an error: keep polling
      }
    }
    const id = setInterval(() => void tick(), 3000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [open, invoice, onChanged])

  const pay = useCallback(async () => {
    setPhase({ kind: 'getting' })
    let inv: InvoiceView
    try {
      inv = await api.invoice(target.roundId)
      setInvoice(inv)
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : t('err.generic') })
      return
    }
    if (inv.nimiqHash || inv.status !== 'issued') {
      // Already paid, or may have been: show it, never pay again.
      setPhase({ kind: 'idle' })
      onChanged()
      return
    }

    const wallet = await getWallet()
    if (!wallet) {
      setPhase({ kind: 'error', message: t('app.openInNimiq') })
      return
    }

    setPhase({ kind: 'wallet' })
    try {
      let hash: string
      let swapId: string | undefined
      if (inv.method === 'nim') {
        if (typeof wallet.sendBasicTransactionWithData !== 'function') {
          setPhase({ kind: 'update' })
          return
        }
        hash = await wallet.sendBasicTransactionWithData({ recipient: inv.recipientNim ?? '', value: inv.luna ?? 0, data: inv.memo ?? '' })
      } else {
        if (typeof wallet.payLightningInvoice !== 'function') {
          setPhase({ kind: 'update' })
          return
        }
        const res = await wallet.payLightningInvoice({ invoice: inv.bolt11 ?? '' })
        hash = res.hash
        swapId = res.swapId
      }
      const saved = await api.submitted(inv.id, { hash, swapId })
      setInvoice(saved)
      setPhase({ kind: 'idle' })
      onChanged()
    } catch (error) {
      const type = errorType(error)
      if (type === 'PERMISSION_DENIED') {
        setPhase({ kind: 'cancelled' })
        return
      }
      if (type === 'DUPLICATE_PAYMENT' || type === 'TRANSACTION_OUTCOME_UNKNOWN') {
        const d = errorData(error)
        try {
          setInvoice(await api.uncertain(inv.id, { type, hash: d.hash, swapId: d.swapId }))
        } catch {
          setInvoice({ ...inv, status: 'checking' })
        }
        setPhase({ kind: 'idle' })
        onChanged()
        return
      }
      if (type === 'INVALID_REQUEST' || type === 'INVALID_TRANSACTION') {
        if (!triedFresh.current) {
          triedFresh.current = true
          try {
            setInvoice(await api.invoice(target.roundId))
          } catch {}
          setPhase({ kind: 'expired' })
          return
        }
        setPhase({ kind: 'error', message: t('pay.expired') })
        return
      }
      if (type === 'UNKNOWN_REQUEST' || type === 'METHOD_NOT_FOUND') {
        setPhase({ kind: 'update' })
        return
      }
      setPhase({ kind: 'error', message: error instanceof Error && error.message ? error.message : t('err.generic') })
    }
  }, [target.roundId, t, onChanged])

  const status = invoice?.status
  const busy = phase.kind === 'getting' || phase.kind === 'wallet'
  const how = target.method === 'mpesa' ? t('pay.how') : target.method === 'lightning' ? t('pay.howLn', { name: target.recipientName }) : t('pay.howNim', { name: target.recipientName })

  return (
    <Sheet open={open} onClose={onClose} label={t('pay.title')}>
      <div className="flex flex-col gap-4 px-5 pt-4" data-testid="pay-sheet">
        <div>
          <p className="text-[13px] font-bold tracking-[0.12em] text-ink-3 uppercase">{t('pay.yourShare')}</p>
          <Kes amount={target.kes} className="signwrite block text-[64px] text-ink" />
          <p className="mt-1 text-[15px] font-semibold text-ink">
            {t('pay.to', { name: target.recipientName })}
            {target.recipientMasked && <span className="ml-2 font-mono text-[13px] font-normal text-ink-2">{target.recipientMasked}</span>}
          </p>
          {invoice?.sats && status !== 'delivered' && <p className="num text-[13px] text-ink-3">{t('pay.sats', { sats: invoice.sats.toLocaleString('en-US') })}</p>}
          {invoice?.luna && status !== 'delivered' && <p className="num text-[13px] text-ink-3">{t('pay.nim', { nim: (invoice.luna / 1e5).toLocaleString('en-US', { maximumFractionDigits: 2 }) })}</p>}
        </div>

        {testnet && <Notice tone="sun">{t('app.testnet')}</Notice>}

        {status === 'delivered' ? (
          <div className="flex flex-col gap-3" data-testid="delivered">
            <p className="font-display text-[20px] font-extrabold text-leaf">
              ✓ {target.method === 'mpesa' ? t('pay.delivered', { name: target.recipientName }) : t('pay.deliveredOther', { name: target.recipientName })}
            </p>
            {target.method === 'mpesa' && (
              <ReceiptSlip
                code={invoice?.receiptCode ?? null}
                amount={invoice?.kesDelivered ?? target.kes}
                to={target.recipientName}
                phone={target.recipientMasked}
                at={invoice?.deliveredAt}
                url={invoice?.receiptUrl}
                linkLabel={t('chip.receipt')}
              />
            )}
            <Button variant="paper" onClick={onClose}>
              {t('pay.close')}
            </Button>
          </div>
        ) : status === 'failed' ? (
          <div className="flex flex-col gap-3" data-testid="failed">
            <Notice>
              <b>{t('pay.failed')}</b> {t('pay.failedSub')}
            </Notice>
            {invoice?.paymentHash && (
              <div>
                <p className="text-[12.5px] font-semibold text-ink-2">{t('chip.quote')}</p>
                <p className="font-mono text-[12px] break-all text-ink select-all">{invoice.paymentHash}</p>
              </div>
            )}
            <a href={supportLink(invoice?.paymentHash)} className="text-[14px] font-semibold underline underline-offset-4">
              {t('chip.contact')} ↗
            </a>
          </div>
        ) : status === 'checking' ? (
          <div className="flex flex-col gap-2" data-testid="checking">
            <Notice tone="sun">
              <span className="flex items-center gap-2 font-bold">
                <Spinner /> {t('pay.checking')}
              </span>
              <span className="mt-1 block">{t('pay.checkingSub')}</span>
            </Notice>
          </div>
        ) : status === 'submitted' ? (
          <div className="flex items-center gap-3 rounded-[10px] border-2 border-ink bg-card p-4" data-testid="submitted">
            <Spinner className="text-[22px]" />
            <span className="text-[15px] font-semibold">{target.method === 'mpesa' ? t('pay.sent') : target.method === 'lightning' ? t('pay.sentLn') : t('pay.sentNim')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {phase.kind === 'cancelled' && <Notice tone="plain">{t('pay.cancelled')}</Notice>}
            {phase.kind === 'expired' && <Notice tone="sun">{t('pay.expired')}</Notice>}
            {phase.kind === 'update' && <Notice>{t('pay.update')}</Notice>}
            {phase.kind === 'error' && <Notice>{phase.message}</Notice>}
            <Button onClick={() => void pay()} busy={busy} disabled={locked || testnet} testId="pay">
              {phase.kind === 'getting' ? t('pay.getting') : phase.kind === 'wallet' ? t('pay.waitingWallet') : t('pay.cta', { amount: `KSh ${target.kes.toLocaleString('en-US')}` })}
            </Button>
            <p className="text-[13px] leading-snug text-ink-3">{how}</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function rank(s: string): number {
  return { issued: 0, expired: 0, submitted: 1, checking: 2, failed: 3, delivered: 4 }[s] ?? 0
}

export function supportLink(paymentHash?: string | null): string {
  const body = `Hello, an M-Pesa payout did not arrive.\n\nPayment hash: ${paymentHash ?? ''}`
  return `mailto:support@tando.me?subject=${encodeURIComponent('M-Pesa payout not delivered')}&body=${encodeURIComponent(body)}`
}
