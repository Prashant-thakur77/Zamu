import { NextResponse } from 'next/server'
import { route } from '@/lib/api'
import { ZamuError } from '@/lib/errors'
import { runScheduledTick } from '@/lib/tick'

export const dynamic = 'force-dynamic'

/** The 5-minute job, reachable over HTTP only with the cron secret. */
export const POST = route(async (request: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) throw new ZamuError('Not allowed.', 401)
  return NextResponse.json(await runScheduledTick())
})
