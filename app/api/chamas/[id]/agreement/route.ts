import { NextResponse } from 'next/server'
import { readBody, requireAddress, route } from '@/lib/api'
import { agreementFor, signAgreement } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

/** The exact text you are about to sign. */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  return NextResponse.json({ message: await agreementFor(id, address) })
})

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const address = await requireAddress()
  const { id } = await ctx.params
  const body = await readBody<{ publicKey?: string; signature?: string }>(request)
  await signAgreement({ chamaId: id, address, publicKey: body.publicKey ?? '', signature: body.signature ?? '' })
  return NextResponse.json({ ok: true })
})
