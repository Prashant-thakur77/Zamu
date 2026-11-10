'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useApp } from './app-provider'
import Link from 'next/link'
import { Mark } from './ui'

const OPEN_URL = 'https://nimpay.app/miniapps/open/zamu.prashantthakur.dev'

/** Desktop only: what Zamu is, and how to open it where it lives, in Nimiq Pay on a phone. */
export function DesktopAside() {
  const { t } = useApp()
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    void QRCode.toString(OPEN_URL, { type: 'svg', margin: 1, color: { dark: '#1d1712', light: '#fbf7ef' } }).then(setSvg)
  }, [])
  return (
    <aside className="relative z-10 hidden w-[520px] shrink-0 flex-col gap-7 lg:flex" data-testid="desktop-aside">
      <div className="flex items-center gap-3 text-ink">
        <Mark size={40} />
        <span className="font-display text-[40px] leading-none font-extrabold tracking-[-0.04em]">zamu</span>
      </div>
      <p className="signwrite text-[84px] text-ink">{t('app.tagline')}</p>
      <p className="max-w-[46ch] text-[18px] leading-relaxed text-ink-2">{t('app.sub')}</p>
      <ol className="flex flex-col gap-2.5">
        {(['app.how1', 'app.how2', 'app.how3'] as const).map((k, i) => (
          <li key={k} className="flex gap-3 text-[16px] leading-snug text-ink">
            <span className="font-display text-[24px] leading-none font-black text-sun">{i + 1}</span>
            {t(k)}
          </li>
        ))}
      </ol>
      <div className="shadow-hard flex items-center gap-5 rounded-[16px] bg-card p-4">
        <div className="h-[132px] w-[132px] shrink-0" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
        <div>
          <p className="text-[17px] font-bold text-ink">{t('desk.scan')}</p>
          <p className="mt-1 text-[14px] leading-snug text-ink-2">{t('desk.scanSub')}</p>
          <p className="mt-2 font-mono text-[12px] break-all text-ink-3">{OPEN_URL.replace('https://', '')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/demo" className="flex min-h-12 items-center rounded-[10px] bg-press px-5 text-[16px] font-bold text-press-ink shadow-[0_3px_0_0_var(--ink-3)]" data-testid="aside-demo">
          {t('app.demo')} →
        </Link>
        <a href="https://github.com/Prashant-thakur77/Zamu" className="min-h-12 content-center px-2 text-[15px] font-semibold text-ink underline decoration-rule decoration-2 underline-offset-4">GitHub</a>
      </div>
      <p className="-mt-3 text-[13.5px] text-ink-3">{t('app.demoNote')}</p>
    </aside>
  )
}
