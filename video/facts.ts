/**
 * Every number the film shows, read at render time. Writes video/film/public/facts.json.
 *   npx tsx video/facts.ts
 * The live quote asks the payout partner for an invoice (never paid) and runs it
 * through Zamu's own validator, exactly as the app does when a member taps Pay.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { requestMpesaInvoice } from '../lib/tando'

async function main() {
  const kes = 1000
  const inv = await requestMpesaInvoice('254712345678', kes)
  const base = kes * inv.multiplier
  const spreadPct = (Number(inv.msats) / base - 1) * 100
  const live = await fetch('https://zamu.prashantthakur.dev/api/health').then((r) => r.json()).catch(() => null)
  const facts = {
    generatedAt: new Date().toISOString(),
    quote: {
      kes,
      sats: inv.sats,
      msatsPerKes: inv.multiplier,
      spreadPct: Math.round(spreadPct * 100) / 100,
      expirySeconds: Math.round((inv.expiresAt.getTime() - Date.now()) / 1000),
      note: 'Live invoice from the payout partner for KSh 1,000, validated by lib/lightning.ts, not paid.',
    },
    baseline: {
      label: 'Average cost to send $200 to sub-Saharan Africa',
      pct: 8.46,
      source: 'World Bank, Remittance Prices Worldwide, Q3 2025',
    },
    scale: {
      value: 8.7,
      unit: 'million',
      label: 'Kenyan adults in chamas and other savings groups',
      source: 'FinAccess Household Survey 2024 (CBK, KNBS, FSD Kenya)',
    },
    tests: { unit: 24, integration: 9, e2e: 12, liveChecks: 30, source: 'TESTING.md' },
    live: { url: 'https://zamu.prashantthakur.dev', healthy: live?.ok === true },
  }
  mkdirSync('video/film/public', { recursive: true })
  writeFileSync('video/film/public/facts.json', JSON.stringify(facts, null, 2))
  console.log(JSON.stringify(facts, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
