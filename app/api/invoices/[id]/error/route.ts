import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { markUncertain, publicInvoice } from '@/lib/shares'

export const dynamic = 'force-dynamic'

/** Nimiq Pay could not say whether the payment went out. Hold it for checking. */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  const body = await readBody<{ type?: string; hash?: string; swapId?: string }>(request)
  return NextResponse.json(publicInvoice(await markUncertain({ id, member: address, hash: body.hash, swapId: body.swapId })))
})
