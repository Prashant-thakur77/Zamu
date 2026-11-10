import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { cancelChama } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  await cancelChama({ chamaId: id, caller: address })
  return NextResponse.json({ ok: true })
})
