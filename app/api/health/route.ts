import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'

export const dynamic = 'force-dynamic'

/** Liveness plus a database round trip, for smoke tests. */
export async function GET() {
  const checks: Record<string, boolean> = {
    authSecret: Boolean(process.env.AUTH_SECRET),
    cronSecret: Boolean(process.env.CRON_SECRET),
    database: false,
  }
  try {
    await getDb().execute(sql`select 1`)
    checks.database = true
  } catch {
    checks.database = false
  }
  const ok = Object.values(checks).every(Boolean)
  return NextResponse.json({ ok, checks, stage: process.env.ZAMU_STAGE ?? 'local' }, { status: ok ? 200 : 503 })
}
