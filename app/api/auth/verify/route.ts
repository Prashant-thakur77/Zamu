import { NextResponse } from 'next/server'
import { getDb, schema } from '@/db'
import { readBody, route } from '@/lib/api'
import { buildAuthMessage } from '@/lib/auth-message'
import { ZamuError } from '@/lib/errors'
import { addressFromPublicKey, isValidNimAddress, normaliseAddress, verifyNimiqMessage } from '@/lib/nimiq-sig'
import { consumeNonce, createSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export const POST = route(async (request: Request) => {
  const body = await readBody<{ address?: string; publicKey?: string; signature?: string }>(request)
  if (!body.address || !isValidNimAddress(body.address) || !body.publicKey || !body.signature) {
    throw new ZamuError('Address, public key and signature are required.')
  }
  const address = normaliseAddress(body.address).replace(/.{4}/g, '$& ').trim()

  const issued = await consumeNonce(address)
  if (!issued) throw new ZamuError('That sign-in request expired. Try again.', 400, 'expired')

  const message = buildAuthMessage({ address, nonce: issued.nonce, issuedAt: issued.issuedAt })
  const ok = verifyNimiqMessage({ message, publicKey: body.publicKey, signature: body.signature })
  if (!ok) throw new ZamuError('That signature does not match.', 401, 'bad_signature')

  // Identity is the address the signing key proves. It normally equals the
  // address Nimiq Pay listed; if the host signs with another key of the same
  // wallet, that key's address is what every later agreement is checked against.
  const proven = addressFromPublicKey(body.publicKey)
  await getDb().insert(schema.users).values({ address: proven }).onConflictDoNothing()
  await createSession(proven)
  return NextResponse.json({ address: proven, listed: address })
})
