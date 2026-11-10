import { NextResponse } from 'next/server'
import { requireAddress, route } from '@/lib/api'
import { listChamasFor } from '@/lib/chamas'

export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const address = await requireAddress()
  const list = await listChamasFor(address)
  const version = list.map((c) => `${c.id.slice(0, 6)}${c.status}${c.memberCount}${c.signedCount}${c.youOwe ? 1 : 0}${c.openRound?.index ?? 0}`).join(',')
  return NextResponse.json({ version })
})
