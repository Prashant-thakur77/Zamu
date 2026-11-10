import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { lockChama } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  const body = await readBody<{ order?: string[] }>(request).catch(() => ({}) as { order?: string[] })
  const chama = await lockChama({ chamaId: id, caller: address, order: body.order })
  return NextResponse.json({ status: chama.status })
})
