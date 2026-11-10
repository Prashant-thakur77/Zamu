import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { markSubmitted, publicInvoice } from '@/lib/shares'

export const dynamic = 'force-dynamic'

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  const body = await readBody<{ hash?: string; swapId?: string }>(request)
  return NextResponse.json(publicInvoice(await markSubmitted({ id, member: address, hash: body.hash ?? '', swapId: body.swapId })))
})
