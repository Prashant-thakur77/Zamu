'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/client/api'
import { errorType, getWallet, hostLanguage, hostNetwork, insideNimiqPay, mockEnabled } from '@/lib/client/nimiq'
import { translate, type Key } from '@/lib/i18n'

type Lang = 'en' | 'sw'

interface AppState {
  ready: boolean
  session: string | null
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
  network: 'mainnet' | 'testnet' | undefined
  canSign: boolean
  inside: boolean
  busy: boolean
  notice: string | null
  clearNotice: () => void
  signIn: () => Promise<string | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('zamu.lang')
    if (saved === 'en' || saved === 'sw') return saved
  } catch {}
  const host = hostLanguage() ?? (typeof navigator !== 'undefined' ? navigator.language : 'en')
  return host?.toLowerCase().startsWith('sw') ? 'sw' : 'en'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<string | null>(null)
  const [lang, setLangState] = useState<Lang>('en')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | undefined>(undefined)
  const [inside, setInside] = useState(false)
  const [canSign, setCanSign] = useState(false)

  useEffect(() => {
    setLangState(initialLang())
    setNetwork(hostNetwork())
    setInside(insideNimiqPay())
    setCanSign(insideNimiqPay() || mockEnabled() || Boolean(window.__zamuNimiq))
    void api
      .me()
      .then((r) => setSession(r.address))
      .catch(() => setSession(null))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('zamu.lang', l)
    } catch {}
  }, [])

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])

  const signIn = useCallback(async (): Promise<string | null> => {
    setNotice(null)
    setBusy(true)
    try {
      const wallet = await getWallet()
      if (!wallet) {
        setNotice(translate(lang, 'app.openInNimiq'))
        return null
      }
      const [address] = await wallet.listAccounts()
      if (!address) throw new Error(translate(lang, 'err.generic'))
      const { message } = await api.nonce(address)
      const { publicKey, signature } = await wallet.sign(message)
      const res = await api.verify({ address, publicKey, signature })
      setSession(res.address)
      return res.address
    } catch (error) {
      const type = errorType(error)
      setNotice(
        type === 'PERMISSION_DENIED'
          ? translate(lang, 'pay.cancelled')
          : error instanceof Error && error.message
            ? error.message
            : translate(lang, 'err.generic'),
      )
      return null
    } finally {
      setBusy(false)
    }
  }, [lang])

  const signOut = useCallback(async () => {
    await api.signOut().catch(() => {})
    setSession(null)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      ready,
      session,
      lang,
      setLang,
      t,
      network,
      canSign,
      inside,
      busy,
      notice,
      clearNotice: () => setNotice(null),
      signIn,
      signOut,
    }),
    [ready, session, lang, setLang, t, network, canSign, inside, busy, notice, signIn, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
