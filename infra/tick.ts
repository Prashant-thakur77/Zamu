import { runScheduledTick } from '../lib/tick'

/**
 * Every 5 minutes: open due rounds and re-check undelivered payouts for 24 h.
 * Also pings the site so a judge opening it rarely meets a cold start.
 */
export async function handler() {
  const ping = process.env.PING_URL
    ? fetch(`${process.env.PING_URL}/api/health`, { signal: AbortSignal.timeout(8000) }).then((r) => r.status).catch(() => 0)
    : Promise.resolve(null)
  const result = await runScheduledTick()
  console.log(JSON.stringify({ msg: 'tick', ...result, ping: await ping }))
  return result
}
