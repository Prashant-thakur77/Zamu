/**
 * The fetch used for every payout-partner call.
 *
 * In local development with MOCK_PAYOUTS=1 this answers Tando and Lightning
 * address requests from an in-process fake, so the whole round can be clicked
 * through without moving money. It can never switch on in production.
 */
export function isMockPayouts(): boolean {
  return (
    process.env.MOCK_PAYOUTS === '1' &&
    process.env.ZAMU_STAGE !== 'production' &&
    // Never on AWS, whatever the environment says.
    !process.env.AWS_LAMBDA_FUNCTION_NAME
  )
}

type Fetch = typeof fetch

let override: Fetch | null = null

/** Tests swap the network out entirely. */
export function setPayoutFetch(fn: Fetch | null): void {
  override = fn
}

export function payoutFetch(): Fetch {
  if (override) return override
  if (isMockPayouts()) {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const { mockPayoutFetch } = await import('./mock-payouts')
      return mockPayoutFetch(String(input instanceof Request ? input.url : input), init)
    }) as Fetch
  }
  return fetch
}
