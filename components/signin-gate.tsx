'use client'

import type { ReactNode } from 'react'
import { useApp } from './app-provider'
import { Button, Notice, Spinner } from './ui'

/** Renders children once signed in; otherwise the one step that gets you there. */
export function SignInGate({ children }: { children: ReactNode }) {
  const { ready, session, signIn, busy, notice, t, canSign } = useApp()
  if (!ready)
    return (
      <p className="flex items-center gap-2 px-4 py-6 text-ink-3">
        <Spinner /> {t('common.loading')}
      </p>
    )
  if (session) return <>{children}</>
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {canSign ? (
        <>
          <Button onClick={() => void signIn()} busy={busy} testId="signin">
            {busy ? t('app.signingIn') : t('app.signIn')}
          </Button>
          <p className="text-center text-[13px] text-ink-3">{t('app.signInWhy')}</p>
        </>
      ) : (
        <Notice tone="plain">
          <b>{t('app.openInNimiq')}</b>
          <br />
          {t('app.openInNimiqHow')}
        </Notice>
      )}
      {notice && <Notice>{notice}</Notice>}
    </div>
  )
}
