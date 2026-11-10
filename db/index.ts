import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

const g = globalThis as unknown as { __zamuDb?: Db; __zamuSql?: ReturnType<typeof postgres> }

/**
 * One connection per Lambda instance (max: 1), released when idle, so a burst
 * of cold starts cannot exhaust a micro RDS instance. Resolved lazily so
 * `next build` works without a database.
 */
export function getDb(): Db {
  if (g.__zamuDb) return g.__zamuDb

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')

  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
  const sql = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 1),
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : 'require',
  })
  g.__zamuSql = sql
  g.__zamuDb = drizzle(sql, { schema })
  return g.__zamuDb
}

/** Close the pool (scripts and tests). */
export async function closeDb(): Promise<void> {
  await g.__zamuSql?.end({ timeout: 5 })
  g.__zamuSql = undefined
  g.__zamuDb = undefined
}

export { schema }
