import { NextResponse } from 'next/server'
import { route } from '@/lib/api'
import { previewChama } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

/** Name, share and who has joined, for someone holding the invite code. */
export const GET = route(async (request: Request) => {
  const code = new URL(request.url).searchParams.get('code') ?? ''
  return NextResponse.json(await previewChama(code))
})
