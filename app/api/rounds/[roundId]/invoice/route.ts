import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { issueInvoice, publicInvoice } from '@/lib/shares'

export const dynamic = 'force-dynamic'

/** Your invoice for this round. Never a second one once the first may be paid. */
export const POST = route(async (_request: Request, ctx: { params: Promise<{ roundId: string }> }) => {
  const address = await requireAddress()
  const { roundId } = await ctx.params
  return NextResponse.json(publicInvoice(await issueInvoice(roundId, address)))
})
