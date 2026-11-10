'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useApp } from './app-provider'

/** The invite as a QR code and a copyable link that opens straight on the join form. */
export function InviteExtras({ code }: { code: string }) {
  const { t } = useApp()
  const [open, setOpen] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [link, setLink] = useState('')

  useEffect(() => {
    setLink(`${window.location.origin}/join?code=${code}`)
  }, [code])

  useEffect(() => {
    if (!open || !link) return
    void QRCode.toString(link, { type: 'svg', margin: 1, color: { dark: '#1d1712', light: '#fbf7ef' } }).then(setSvg)
  }, [open, link])

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} data-testid="show-qr"
          className="min-h-11 flex-1 rounded-[10px] border-2 border-paper/40 text-[14px] font-semibold text-paper">
          {open ? t('inv.hideQr') : t('inv.showQr')}
        </button>
        <button type="button" data-testid="copy-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {}
          }}
          className="min-h-11 flex-1 rounded-[10px] border-2 border-paper/40 text-[14px] font-semibold text-paper">
          {copied ? t('inv.copied') : t('inv.copyLink')}
        </button>
      </div>
      {open && (
        <div className="anim-slip flex flex-col items-center gap-2 rounded-[10px] bg-card p-4">
          {svg ? <div className="w-[220px]" data-testid="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="h-[220px]" />}
          <p className="text-center text-[13px] text-ink-2">{t('inv.scan')}</p>
          <p className="font-mono text-[11.5px] break-all text-ink-3">{link}</p>
        </div>
      )}
    </div>
  )
}
