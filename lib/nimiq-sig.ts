import { ed25519 } from '@noble/curves/ed25519.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Server-side verification of Nimiq signed messages, without the WASM core.
 *
 * Nimiq wallets sign sha256("\x16Nimiq Signed Message:\n" + length + message)
 * with Ed25519. The address is the first 20 bytes of blake2b-256(publicKey),
 * printed in Nimiq's IBAN-style base32 form.
 */

export const MSG_PREFIX = '\x16Nimiq Signed Message:\n'

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, '')
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) throw new Error('Not hex')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function base32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function ibanCheck(str: string): number {
  const num = str
    .toUpperCase()
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0)
      return code >= 48 && code <= 57 ? c : (code - 55).toString()
    })
    .join('')
  let remainder = ''
  for (let i = 0; i < Math.ceil(num.length / 6); i += 1) {
    remainder = (parseInt(remainder + num.slice(i * 6, i * 6 + 6), 10) % 97).toString()
  }
  return parseInt(remainder, 10)
}

/** "NQ07 0000 …" for 20 raw address bytes. */
export function addressFromBytes(bytes: Uint8Array): string {
  const b32 = base32(bytes)
  const check = ('00' + (98 - ibanCheck(b32 + 'NQ00'))).slice(-2)
  return `NQ${check}${b32}`.replace(/.{4}/g, '$& ').trim()
}

export function addressFromPublicKey(publicKeyHex: string): string {
  const hash = blake2b(hexToBytes(publicKeyHex), { dkLen: 32 })
  return addressFromBytes(hash.subarray(0, 20))
}

export function normaliseAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase()
}

export function isValidNimAddress(address: string): boolean {
  const a = normaliseAddress(address)
  if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(a)) return false
  if ([...a.slice(4)].some((c) => !ALPHABET.includes(c))) return false
  return ibanCheck(a.slice(4) + a.slice(0, 4)) === 1
}

/** The exact bytes a Nimiq wallet hashes before signing. */
export function signedMessageHash(message: string, lengthMode: 'bytes' | 'chars' = 'bytes'): Uint8Array {
  const data = new TextEncoder().encode(message)
  const length = lengthMode === 'bytes' ? data.length : message.length
  return sha256(new TextEncoder().encode(`${MSG_PREFIX}${length}${message}`))
}

/**
 * True when `signature` is a Nimiq signature over `message` by `publicKey`,
 * and (if given) that public key belongs to `expectedAddress`.
 */
export function verifyNimiqMessage(params: {
  message: string
  publicKey: string
  signature: string
  expectedAddress?: string
}): boolean {
  try {
    const pub = hexToBytes(params.publicKey)
    const sig = hexToBytes(params.signature)
    if (pub.length !== 32 || sig.length !== 64) return false

    if (params.expectedAddress) {
      const derived = normaliseAddress(addressFromPublicKey(params.publicKey))
      if (derived !== normaliseAddress(params.expectedAddress)) return false
    }

    // Byte length is the documented form; the character count only differs
    // for non-ASCII text and is accepted for hosts that count code units.
    for (const mode of ['bytes', 'chars'] as const) {
      if (ed25519.verify(sig, signedMessageHash(params.message, mode), pub)) return true
    }
    return false
  } catch {
    return false
  }
}
