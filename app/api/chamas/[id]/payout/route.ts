import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { updatePayout, type PayoutInput } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  const body = await readBody<{ payout?: PayoutInput; consent?: boolean }>(request)
  await updatePayout({ chamaId: id, address, payout: body.payout ?? { method: 'mpesa' }, consent: body.consent === true })
  return NextResponse.json({ ok: true })
})
