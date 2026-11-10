'use client'

import { useApp } from '@/components/app-provider'
import { ChamaList } from '@/components/chama-list'
import { SignInGate } from '@/components/signin-gate'
import { Button, TopBar } from '@/components/ui'

export default function ChamasPage() {
  const { t } = useApp()
  return (
    <main className="flex flex-1 flex-col">
      <TopBar />
      <h1 className="signwrite px-4 pt-2 text-[44px]">{t('app.yours')}</h1>
      <SignInGate>
        <div className="px-4 pt-2">
          <ChamaList />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button href="/start" testId="chamas-start">{t('app.start')}</Button>
            <Button href="/join" variant="paper">{t('app.join')}</Button>
          </div>
        </div>
      </SignInGate>
    </main>
  )
}
