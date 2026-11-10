import { openDueRounds } from './rounds'
import { recheckOpenInvoices } from './shares'

/** Open rounds whose day has come, then re-check undelivered shares. */
export async function runScheduledTick() {
  const started = Date.now()
  const opened = await openDueRounds()
  const shares = await recheckOpenInvoices()
  return { opened, ...shares, ms: Date.now() - started }
}
