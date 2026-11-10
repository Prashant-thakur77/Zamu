'use client'

import { ed25519 } from '@noble/curves/ed25519.js'
import { addressFromPublicKey, signedMessageHash } from '../nimiq-sig'

/**
 * A stand-in for Nimiq Pay, for local development in a desktop browser only
 * (NEXT_PUBLIC_MOCK_NIMIQ=1). Signatures are real Ed25519 Nimiq signatures, so
 * the server verifies them exactly as it would in production. Payments return
 * fake hashes; the mock payout partner on the server does the rest.
 *
 * Outcomes can be forced for testing with localStorage 'zamu.mock.next':
 * cancel | duplicate | unknown | invalid | unsupported
 */

const KEY = 'zamu.mock.key'

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
function unhex(h: string): Uint8Array {
  return new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)))
}

function secretKey(): Uint8Array {
  let k: string | null = null
  try {
    k = localStorage.getItem(KEY)
  } catch {}
  if (!k) {
    k = hex(ed25519.utils.randomSecretKey())
    try {
      localStorage.setItem(KEY, k)
    } catch {}
  }
  return unhex(k)
}

export class MockProviderError extends Error {
  constructor(
    readonly type: string,
    message: string,
    readonly data?: unknown,
  ) {
    super(message)
  }
}

function forced(): string | null {
  try {
    const v = localStorage.getItem('zamu.mock.next')
    if (v) localStorage.removeItem('zamu.mock.next')
    return v
  } catch {
    return null
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function randomHash(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return hex(b)
}

export function createMockWallet() {
  const sk = secretKey()
  const pk = ed25519.getPublicKey(sk)
  const address = addressFromPublicKey(hex(pk))
  const fail = (paid = false) => {
    const f = forced()
    if (!f) return
    const ids = paid ? { hash: randomHash(), swapId: `swap_${randomHash().slice(0, 10)}` } : undefined
    if (f === 'cancel') throw new MockProviderError('PERMISSION_DENIED', 'User declined')
    if (f === 'duplicate') throw new MockProviderError('DUPLICATE_PAYMENT', 'Already paid', ids)
    if (f === 'unknown') throw new MockProviderError('TRANSACTION_OUTCOME_UNKNOWN', 'Outcome unknown', ids)
    if (f === 'invalid') throw new MockProviderError('INVALID_REQUEST', 'Invoice expired')
    if (f === 'unsupported') throw new MockProviderError('UNKNOWN_REQUEST', 'Method not supported')
  }
  return {
    isMock: true,
    async listAccounts() {
      await delay(150)
      fail()
      return [address]
    },
    async sign(message: string | { message: string }) {
      await delay(250)
      fail()
      const text = typeof message === 'string' ? message : message.message
      const sig = ed25519.sign(signedMessageHash(text), sk)
      return { publicKey: hex(pk), signature: hex(sig) }
    },
    async payLightningInvoice({ invoice }: { invoice: string }) {
      await delay(900)
      fail(true)
      if (!invoice.startsWith('lnbc')) throw new MockProviderError('INVALID_REQUEST', 'Invoice network mismatch')
      return { hash: randomHash(), swapId: `swap_${randomHash().slice(0, 10)}` }
    },
    async sendBasicTransactionWithData(_tx: { recipient: string; value: number; data: string }) {
      await delay(700)
      fail()
      return randomHash()
    },
    async getBalance() {
      return 12_345_600_000
    },
    async sendNewStakerTransaction() {
      await delay(500)
      fail()
      return randomHash()
    },
    async sendStakeTransaction() {
      await delay(500)
      fail()
      return randomHash()
    },
    async sendSetActiveStakeTransaction() {
      await delay(500)
      fail()
      return randomHash()
    },
    async sendRetireStakeTransaction() {
      await delay(500)
      fail()
      return randomHash()
    },
    async sendRemoveStakeTransaction() {
      await delay(500)
      fail()
      return randomHash()
    },
  }
}
