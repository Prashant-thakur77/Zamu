import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { createChama, listChamasFor, type Frequency, type PayoutInput } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const address = await requireAddress()
  return NextResponse.json({ chamas: await listChamasFor(address) })
})

export const POST = route(async (request: Request) => {
  const address = await requireAddress()
  const body = await readBody<{
    name?: string
    shareKes?: number
    frequency?: Frequency
    size?: number
    skipUntilPaidUp?: boolean
    displayName?: string
    payout?: PayoutInput
    consent?: boolean
    startsAt?: string
  }>(request)
  const chama = await createChama({
    creator: address,
    name: body.name ?? '',
    shareKes: Number(body.shareKes),
    frequency: body.frequency ?? 'weekly',
    size: Number(body.size),
    skipUntilPaidUp: body.skipUntilPaidUp !== false,
    displayName: body.displayName ?? '',
    payout: body.payout ?? { method: 'mpesa' },
    consent: body.consent === true,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
  })
  return NextResponse.json({ id: chama.id, inviteCode: chama.inviteCode }, { status: 201 })
})
