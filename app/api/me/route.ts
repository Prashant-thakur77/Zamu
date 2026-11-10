import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { reliability, summaryFor } from '@/lib/me'

export const dynamic = 'force-dynamic'

/** Your record, totals, what you owe next and when your turns come, across every chama. */
export const GET = route(async () => {
  const address = await requireAddress()
  const s = await summaryFor(address)
  return NextResponse.json({ ...s, reliability: reliability(s.record) })
})
