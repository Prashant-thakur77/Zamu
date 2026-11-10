import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { signedAgreement } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

/** Any member can read, and re-verify, any other member's signed agreement. */
export const GET = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const viewer = await requireAddress()
  const { id } = await ctx.params
  const address = new URL(request.url).searchParams.get('address') ?? ''
  return NextResponse.json(await signedAgreement(id, viewer, address))
})
