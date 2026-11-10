'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from './app-provider'

const TABS = [
  { href: '/', key: 'nav.home', icon: 'home' },
  { href: '/chamas', key: 'nav.chamas', icon: 'ring' },
  { href: '/me', key: 'nav.me', icon: 'me' },
  { href: '/help', key: 'nav.help', icon: 'help' },
] as const

function Icon({ kind, on }: { kind: string; on: boolean }) {
  const c = 'currentColor'
  if (kind === 'home') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" fill={on ? 'var(--sun)' : 'none'} /></svg>
  if (kind === 'ring')
    return (
      <svg width="24" height="24" viewBox="0 0 24 24">
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2
          return <circle key={i} cx={12 + Math.cos(a) * 8} cy={12 + Math.sin(a) * 8} r={i === 0 ? 3.4 : 2.2} fill={i === 0 && on ? 'var(--sun)' : c} />
        })}
      </svg>
    )
  if (kind === 'me') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2"><circle cx="12" cy="8" r="4" fill={on ? 'var(--sun)' : 'none'} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2"><circle cx="12" cy="12" r="9" fill={on ? 'var(--sun)' : 'none'} /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" /></svg>
}

/** App navigation, thumb-reachable, above the phone's home indicator. */
export function TabBar() {
  const { t } = useApp()
  const path = usePathname()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] lg:static lg:pb-0">
      <div className="grid w-full max-w-[480px] grid-cols-4 border-t-2 border-ink bg-card">
        {TABS.map((tab) => {
          const on = tab.href === '/' ? path === '/' : path.startsWith(tab.href) || (tab.href === '/chamas' && path.startsWith('/c/'))
          return (
            <Link key={tab.href} href={tab.href} aria-current={on ? 'page' : undefined} data-testid={`tab-${tab.icon}`}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11.5px] font-bold ${on ? 'text-ink' : 'text-ink-3'}`}>
              <Icon kind={tab.icon} on={on} />
              {t(tab.key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/** Space so page content never hides under the tab bar. */
export function TabSpacer() {
  return <div aria-hidden className="h-[76px] shrink-0 lg:hidden" />
}
