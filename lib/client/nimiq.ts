'use client'

/**
 * The Nimiq Pay connection, in one place.
 *
 * Inside Nimiq Pay this is the SDK's typed provider. In local development with
 * NEXT_PUBLIC_MOCK_NIMIQ=1 (or when a test injects window.__zamuNimiq), it is a
 * mock wallet that makes real signatures. Everywhere else it is null, and the
 * app explains how to open it inside Nimiq Pay.
 */

export type Lang = 'en' | 'sw'

export interface Wallet {
  isMock?: boolean
  listAccounts(): Promise<string[]>
  sign(message: string): Promise<{ publicKey: string; signature: string }>
  payLightningInvoice(req: { invoice: string }): Promise<{ hash: string; swapId: string }>
  sendBasicTransactionWithData(tx: { recipient: string; value: number; data: string }): Promise<string>
  getBalance(address: string): Promise<number>
  sendNewStakerTransaction(tx: { delegation: string; value: number }): Promise<string>
  sendStakeTransaction(tx: { value: number }): Promise<string>
  sendSetActiveStakeTransaction(tx: { newActiveBalance: number }): Promise<string>
  sendRetireStakeTransaction(tx: { retireStake: number }): Promise<string>
  sendRemoveStakeTransaction(tx: { value: number }): Promise<string>
}

declare global {
  interface Window {
    __zamuNimiq?: Wallet
  }
}

let cached: Promise<Wallet | null> | null = null

export function mockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_NIMIQ === '1'
}

export function insideNimiqPay(): boolean {
  return typeof window !== 'undefined' && Boolean(window.nimiqPay || window.nimiq)
}

export function getWallet(timeout = 4000): Promise<Wallet | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.__zamuNimiq) return Promise.resolve(window.__zamuNimiq)
  if (cached) return cached
  cached = (async () => {
    if (mockEnabled()) {
      const { createMockWallet } = await import('./mock-wallet')
      return createMockWallet() as unknown as Wallet
    }
    if (insideNimiqPay()) {
      try {
        const { init } = await import('@nimiq/mini-app-sdk')
        return (await init({ timeout })) as unknown as Wallet
      } catch {
        cached = null
        return null
      }
    }
    cached = null
    return null
  })()
  return cached
}

export function hostNetwork(): 'mainnet' | 'testnet' | undefined {
  if (typeof window === 'undefined') return undefined
  return window.nimiqPay?.network
}

export function hostLanguage(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.nimiqPay?.language
}

/** The provider error type, whichever SDK generation threw it. */
export function errorType(error: unknown): string | null {
  const e = error as { type?: unknown; code?: unknown; message?: unknown; name?: unknown } | null
  if (e && typeof e.type === 'string') return e.type
  if (e && typeof e.name === 'string' && /PermissionDenied/.test(e.name)) return 'PERMISSION_DENIED'
  const m = typeof e?.message === 'string' ? e.message : ''
  if (/not a function|is not supported|unknown method|method not found/i.test(m)) return 'UNKNOWN_REQUEST'
  if (/denied|declined|rejected|cancel/i.test(m)) return 'PERMISSION_DENIED'
  return null
}

export function errorData(error: unknown): { hash?: string; swapId?: string } {
  const d = (error as { data?: unknown } | null)?.data as { hash?: unknown; swapId?: unknown } | undefined
  return {
    hash: typeof d?.hash === 'string' ? d.hash : undefined,
    swapId: typeof d?.swapId === 'string' ? d.swapId : undefined,
  }
}
