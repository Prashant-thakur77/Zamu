import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { leaveChama } from '@/lib/me'

export const dynamic = 'force-dynamic'

export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  await leaveChama(id, address)
  return NextResponse.json({ ok: true })
})
