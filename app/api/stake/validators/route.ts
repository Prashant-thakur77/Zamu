import { NextResponse } from 'next/server'
import { route } from '@/lib/api'
import { listValidators, pickDefaultValidator } from '@/lib/stake'

export const dynamic = 'force-dynamic'

export const GET = route(async () => {
  const list = await listValidators()
  return NextResponse.json({ validators: list.slice(0, 12), default: pickDefaultValidator(list) })
})
