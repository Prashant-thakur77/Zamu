import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { getChamaForMember } from '@/lib/chamas'
import { chamaView } from '@/lib/views'

export const dynamic = 'force-dynamic'

export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  return NextResponse.json(chamaView(await getChamaForMember(id, address), address))
})
