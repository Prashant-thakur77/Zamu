import { NextResponse } from 'next/server'
import { route } from '@/lib/api'
import { buildAuthMessage } from '@/lib/auth-message'
import { ZamuError } from '@/lib/errors'
import { isValidNimAddress, normaliseAddress } from '@/lib/nimiq-sig'
import { issueNonce } from '@/lib/session'

export const dynamic = 'force-dynamic'

const spaced = (a: string) => normaliseAddress(a).replace(/.{4}/g, '$& ').trim()

export const GET = route(async (request: Request) => {
  const raw = new URL(request.url).searchParams.get('address') ?? ''
  if (!isValidNimAddress(raw)) throw new ZamuError('That is not a Nimiq address.')
  const address = spaced(raw)
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const issuedAt = new Date().toISOString()
  await issueNonce(nonce, address, issuedAt)
  return NextResponse.json({ message: buildAuthMessage({ address, nonce, issuedAt }), address })
})
