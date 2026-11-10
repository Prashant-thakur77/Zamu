import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { joinChama, type PayoutInput } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

export const POST = route(async (request: Request) => {
  const address = await requireAddress()
  const body = await readBody<{ code?: string; displayName?: string; payout?: PayoutInput; consent?: boolean }>(request)
  const chama = await joinChama({
    address,
    inviteCode: body.code ?? '',
    displayName: body.displayName ?? '',
    payout: body.payout ?? { method: 'mpesa' },
    consent: body.consent === true,
  })
  return NextResponse.json({ id: chama.id })
})
