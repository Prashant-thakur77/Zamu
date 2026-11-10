/**
 * Server-side reads against the Nimiq chain.
 *
 * Same stance as lib/rpc.ts for Polygon: the wallet is for signing and sending,
 * and everything we merely need to *know* is read directly from an RPC node,
 * so verification works whether or not anyone's phone is open.
 */

const DEFAULT_RPC = 'https://rpc.nimiqwatch.com'

export const NIM = {
  symbol: 'NIM',
  /** 1 NIM = 100,000 Luna. */
  decimals: 5,
  explorer: 'https://nimiq.watch',
} as const

/** Confirmations before a NIM transfer counts as settled. Albatross finalises fast. */
export const NIM_CONFIRMATIONS = 2

export function nimRpcUrl(): string {
  return process.env.NIMIQ_RPC_URL || DEFAULT_RPC
}

interface RpcEnvelope<T> {
  result?: { data: T; metadata: unknown }
  error?: { code: number; message: string; data?: string }
}

export class NimRpcError extends Error {
  constructor(
    message: string,
    readonly notFound = false,
  ) {
    super(message)
  }
}

export async function nimRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(nimRpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new NimRpcError(`Nimiq RPC ${method} failed with HTTP ${res.status}`)

  const body = (await res.json()) as RpcEnvelope<T>
  if (body.error) {
    const detail = String(body.error.data ?? body.error.message ?? '')
    throw new NimRpcError(detail || `Nimiq RPC ${method} failed`, /not found/i.test(detail))
  }
  if (body.result === undefined) throw new NimRpcError(`Nimiq RPC ${method} returned nothing`)
  return body.result.data
}

/** The fields we rely on. The node returns more; these are the ones that matter. */
export interface NimTransaction {
  hash: string
  blockNumber: number
  confirmations: number
  from: string
  to: string
  /** Luna. */
  value: number
  /** Hex-encoded payload; holds the memo for basic transactions with data. */
  recipientData?: string
  senderData?: string
  executionResult: boolean
}

/** Null when the transaction is not (yet) in a block. */
export async function getNimTransaction(hash: string): Promise<NimTransaction | null> {
  try {
    return await nimRpc<NimTransaction>('getTransactionByHash', [hash])
  } catch (error) {
    if (error instanceof NimRpcError && error.notFound) return null
    throw error
  }
}

interface NimAccount {
  address: string
  /** Luna. */
  balance: number
}

/** NIM balance as a decimal string. */
export async function getNimBalance(address: string): Promise<string> {
  const account = await nimRpc<NimAccount>('getAccountByAddress', [address])
  return formatNim(BigInt(account.balance))
}

export function getNimBlockNumber(): Promise<number> {
  return nimRpc<number>('getBlockNumber', [])
}

/**
 * Nimiq addresses are user-friendly strings — "NQ07 0000 …" — case-insensitive
 * and conventionally space-grouped. Normalise so comparisons don't hinge on how
 * a particular tool chose to print one.
 */
export function normaliseNimAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase()
}

export function isNimAddress(address: string): boolean {
  return /^NQ\d{2}[0-9A-Z]{32}$/.test(normaliseNimAddress(address))
}

/** 5 decimals: 123456789n Luna -> "1234.56789". */
export function formatNim(luna: bigint): string {
  const negative = luna < 0n
  const abs = negative ? -luna : luna
  const whole = abs / 100_000n
  const frac = (abs % 100_000n).toString().padStart(5, '0')
  return `${negative ? '-' : ''}${whole}.${frac}`
}

/** "12.5" -> 1250000n Luna. Throws on more than 5 decimals or garbage. */
export function parseNim(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{0,5})?$/.test(trimmed)) throw new Error('Not a valid NIM amount.')
  const [whole, frac = ''] = trimmed.split('.')
  return BigInt(whole) * 100_000n + BigInt(frac.padEnd(5, '0'))
}

export async function getNimTransactionsByAddress(address: string, max = 50): Promise<NimTransaction[]> {
  return nimRpc<NimTransaction[]>('getTransactionsByAddress', [address, max, null])
}

export interface NimStaker {
  address: string
  balance: number
  delegation: string | null
  inactiveBalance: number
  inactiveFrom: number | null
  retiredBalance: number
}

/** Null when the address has never staked. */
export async function getNimStaker(address: string): Promise<NimStaker | null> {
  try {
    return await nimRpc<NimStaker>('getStakerByAddress', [address])
  } catch (error) {
    if (error instanceof NimRpcError && /No staker/i.test(error.message)) return null
    throw error
  }
}

export function hexToUtf8(hex: string | undefined): string {
  if (!hex) return ''
  try {
    const bytes = new Uint8Array(hex.match(/../g)?.map((b) => parseInt(b, 16)) ?? [])
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}
