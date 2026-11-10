import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { confirmReceived, publicInvoice } from '@/lib/shares'

export const dynamic = 'force-dynamic'

export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  return NextResponse.json(publicInvoice(await confirmReceived(id, address)))
})
