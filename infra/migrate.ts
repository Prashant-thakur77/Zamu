import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { closeDb, getDb } from '../db'

/**
 * Apply database migrations from inside AWS (the database only needs to be
 * reachable from Lambda). Invoked once after each deploy:
 *   aws lambda invoke --function-name zamu-<stage>-migrate /dev/stdout
 */
export async function handler() {
  await migrate(getDb(), { migrationsFolder: 'migrations' })
  await closeDb()
  return { ok: true }
}
