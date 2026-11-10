'use client'

import type { ChamaView, InvoiceView } from '../views'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      method: init?.method ?? (init?.json !== undefined ? 'POST' : 'GET'),
      headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0, 'offline')
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const b = body as { error?: string; code?: string } | null
    throw new ApiError(b?.error ?? `Something went wrong (${res.status}). Try again.`, res.status, b?.code)
  }
  return body as T
}

export type PayoutInput = { method: 'mpesa' | 'lightning' | 'nim'; phone?: string; lightning?: string; nim?: string }

export interface ChamaListItem {
  id: string
  name: string
  shareKes: number
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  size: number
  status: 'forming' | 'signing' | 'active' | 'completed' | 'cancelled'
  inviteCode: string
  memberCount: number
  signedCount: number
  openRound: { index: number; dueAt: string; recipientName: string; yourTurn: boolean } | null
  youOwe: boolean
}

export interface Preview {
  name: string
  shareKes: number
  frequency: ChamaListItem['frequency']
  size: number
  status: ChamaListItem['status']
  skipUntilPaidUp: boolean
  members: string[]
}

export const api = {
  me: () => call<{ address: string | null }>('/api/auth/me'),
  nonce: (address: string) => call<{ message: string; address: string }>(`/api/auth/nonce?address=${encodeURIComponent(address)}`),
  verify: (b: { address: string; publicKey: string; signature: string }) => call<{ address: string }>('/api/auth/verify', { json: b }),
  signOut: () => call<{ ok: true }>('/api/auth/signout', { method: 'POST' }),
  list: () => call<{ chamas: ChamaListItem[] }>('/api/chamas'),
  listVersion: () => call<{ version: string }>('/api/chamas/version'),
  create: (b: {
    name: string
    shareKes: number
    frequency: string
    size: number
    skipUntilPaidUp: boolean
    displayName: string
    payout: PayoutInput
    consent: boolean
  }) => call<{ id: string; inviteCode: string }>('/api/chamas', { json: b }),
  preview: (code: string) => call<Preview>(`/api/chamas/preview?code=${encodeURIComponent(code)}`),
  join: (b: { code: string; displayName: string; payout: PayoutInput; consent: boolean }) => call<{ id: string }>('/api/chamas/join', { json: b }),
  chama: (id: string) => call<ChamaView>(`/api/chamas/${id}`),
  version: (id: string) => call<{ version: string }>(`/api/chamas/${id}/version`),
  lock: (id: string, order?: string[]) => call<{ status: string }>(`/api/chamas/${id}/lock`, { json: { order } }),
  cancel: (id: string) => call<{ ok: true }>(`/api/chamas/${id}/cancel`, { method: 'POST' }),
  agreement: (id: string) => call<{ message: string }>(`/api/chamas/${id}/agreement`),
  signAgreement: (id: string, b: { publicKey: string; signature: string }) => call<{ ok: true }>(`/api/chamas/${id}/agreement`, { json: b }),
  invoice: (roundId: string) => call<InvoiceView>(`/api/rounds/${roundId}/invoice`, { method: 'POST' }),
  submitted: (id: string, b: { hash: string; swapId?: string }) => call<InvoiceView>(`/api/invoices/${id}/submitted`, { json: b }),
  uncertain: (id: string, b: { type: string; hash?: string; swapId?: string }) => call<InvoiceView>(`/api/invoices/${id}/error`, { json: b }),
  status: (id: string) => call<InvoiceView>(`/api/invoices/${id}/status`),
  received: (id: string) => call<InvoiceView>(`/api/invoices/${id}/received`, { method: 'POST' }),
  reserve: (staker?: string) => call<Reserve>(`/api/stake${staker ? `?staker=${encodeURIComponent(staker)}` : ''}`),
  recordStake: (b: { kind: 'stake' | 'retire' | 'remove'; luna: number; validator?: string; txHash?: string }) => call<{ ok: true }>('/api/stake', { json: b }),
}

export interface Reserve {
  staker: boolean
  delegation: string | null
  validator: { address: string; name: string; fee: number } | null
  defaultValidator: { address: string; name: string; fee: number; payoutType: string } | null
  activeNim: number
  inactiveNim: number
  retiredNim: number
  inactiveFrom: number | null
  kesPerNim: number | null
  nextShares: { dueAt: string; kes: number }[]
  covers: number
}
