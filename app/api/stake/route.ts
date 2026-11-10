import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { ZamuError } from '@/lib/errors'
import { isValidNimAddress } from '@/lib/nimiq-sig'
import { recordStakeEvent, reserveStatus } from '@/lib/stake'

export const dynamic = 'force-dynamic'

/** Reserve meter: staked NIM, the shares it covers, and the default validator. */
export const GET = route(async (request: Request) => {
  const address = await requireAddress()
  const staker = new URL(request.url).searchParams.get('staker') || address
  if (!isValidNimAddress(staker)) throw new ZamuError('That is not a Nimiq address.')
  return NextResponse.json(await reserveStatus(staker, address))
})

export const POST = route(async (request: Request) => {
  const address = await requireAddress()
  const body = await readBody<{ kind?: 'stake' | 'retire' | 'remove'; luna?: number; validator?: string; txHash?: string }>(request)
  if (!body.kind || !['stake', 'retire', 'remove'].includes(body.kind)) throw new ZamuError('Unknown staking step.')
  await recordStakeEvent({ address, kind: body.kind, luna: Number(body.luna), validator: body.validator, txHash: body.txHash })
  return NextResponse.json({ ok: true })
})
