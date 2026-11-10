# Testing

What was tested, how, and the result. Real-money payouts are the one thing not done yet; see "Real-money test" at the end.

## Automated suites

| Suite | Command | What it covers | Result |
| --- | --- | --- | --- |
| Type check | `npm run typecheck` | whole app, after Next route type generation | pass |
| Production build | `npm run build` | Next.js 16.4.6 build | pass |
| Unit | `npm run test:unit` | phone normalisation; invoice validation (wrong network, amount mismatch, wrong recipient, about to expire, description hash); a real Tando invoice decoded and validated; Tando status mapping; round completes only when all delivered; skip-until-paid-up planning; on-time record; reserve meter; agreement text; invite/nudge messages; Nimiq address derivation and message signatures checked against `@nimiq/core`; every English string has a Swahili one | 24/24 pass |
| Integration | `npm run test:integration` | real Postgres + mock payout partner: create/join/lock/sign with real Nimiq keys, refused forged agreement signature, round opens on last signature, phones never leak in the invite preview and are masked for other members, one invoice per member-round, duplicate tap returns the same invoice, never re-issued after submit or an uncertain result, expired unpaid invoice replaced, delivered with receipt, round closes, failed payout, wrong-network invoice refused, skip-until-paid-up swaps the turn, Lightning address payout (verify URL and one-tap recipient confirm), NIM payout found by memo and gated on confirmations | 9/9 pass |
| End-to-end | `npm run test:e2e` | Playwright, 360×780, mock Nimiq wallet (real signatures) and mock payout partner | 12/12 pass |

### End-to-end flows

- Create a chama, share the invite code, two members join with consent and an M-Pesa number, creator fixes the order, all three sign, round 1 opens, two members pay, each sees "Sent", then "Delivered" with the M-Pesa receipt, the recipient sees it land without refreshing, the round closes and the on-time record shows "1 on time · 0 late".
- Cancelled in the wallet ("Cancelled. Nothing was sent.", Pay still usable), invalid/expired invoice (fresh invoice fetched, tap again), outcome unknown (status Checking, Pay button gone, resolves to delivered on its own), duplicate payment (Checking).
- Failed payout: contact link for the payout partner and the full payment hash to quote.
- Slow payout: stays "Paying" and never turns Paid.
- Testnet host: banner telling the member to switch to mainnet.
- Bad phone number refused, consent box required.
- First screen copy and buttons, Swahili toggle and Swahili from the host language, demo chama payment with receipt, staked reserve meter + default validator + stake, and no sideways scroll on any screen at 360 px.

## Live partner endpoints (read-only)

| Check | Result |
| --- | --- |
| `GET bitcoin.co.ke/.well-known/lnurlp/254712345678` resolves a phone | pass: KES currency, min 15, max 50,000, multiplier 10,443 msats/KES |
| Fetch a live invoice for KES 20 (not paid) | pass: `lnbc2120n…`, `converted: 20`, 212,000 msats (1.5% over rate), 120 s expiry, description names the phone, receipt URL returned |
| Validate that invoice with Zamu's validator | pass (unit test uses this exact invoice) |
| `GET api.tando.ltd/v1/transactions/btcpay/payment-hash/<hash>` | pass: unknown hash returns `transaction-not-found`, mapped to pending |

## Bugs found by testing and fixed

- A non-numeric `currencyAmountSent` from the partner became `NaN` and broke the delivered update. Now parsed defensively.
- When the last member paid, the round closed and the pay sheet vanished before they saw their receipt. The sheet now stays bound to the round it opened for.

## Not run here

- Nimiq testnet inside Nimiq Pay on a phone (sign-in, agreement signing, staking, NIM payout) needs a phone with Nimiq Pay; steps are in the real-money checklist below.
- Real Lightning payouts to M-Pesa: not done; waiting for the real-money test.
