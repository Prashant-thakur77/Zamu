# Testing

What was tested, how, and the result. 

## Automated suites

| Suite | Command | What it covers | Result |
| --- | --- | --- | --- |
| Type check | `npm run typecheck` | whole app, after Next route type generation | pass |
| Production build | `npm run build` | Next.js 16.4.6 build | pass |
| Unit | `npm run test:unit` | phone normalisation; invoice validation (wrong network, amount mismatch, wrong recipient, about to expire, description hash); a real Tando invoice decoded and validated; Tando status mapping; round completes only when all delivered; skip-until-paid-up planning; on-time record; reserve meter; agreement text; invite/nudge messages; Nimiq address derivation and message signatures checked against `@nimiq/core`; every English string has a Swahili one | 24/24 pass |
| Integration | `npm run test:integration` | real Postgres + mock payout partner: create/join/lock/sign with real Nimiq keys, refused forged agreement signature, round opens on last signature, phones never leak in the invite preview and are masked for other members, one invoice per member-round, duplicate tap returns the same invoice, never re-issued after submit or an uncertain result, expired unpaid invoice replaced, delivered with receipt, round closes, failed payout, wrong-network invoice refused, skip-until-paid-up swaps the turn, Lightning address payout (verify URL and one-tap recipient confirm), NIM payout found by memo and gated on confirmations | 10/10 pass (adds: my record totals, what I owe, received turns; leaving rules) |
| End-to-end | `npm run test:e2e` | Playwright on two projects, phone (360×780) and desktop (1440×900), mock Nimiq wallet (real signatures) and mock payout partner | 15/15 pass on phone, 15/15 on desktop |

### End-to-end flows

- Create a chama, share the invite code, two members join with consent and an M-Pesa number, creator fixes the order, all three sign, round 1 opens, two members pay, each sees "Sent", then "Delivered" with the M-Pesa receipt, the recipient sees it land without refreshing, the round closes and the on-time record shows "1 on time · 0 late".
- Cancelled in the wallet ("Cancelled. Nothing was sent.", Pay still usable), invalid/expired invoice (fresh invoice fetched, tap again), outcome unknown (status Checking, Pay button gone, resolves to delivered on its own), duplicate payment (Checking).
- Failed payout: contact link for the payout partner and the full payment hash to quote.
- Slow payout: stays "Paying" and never turns Paid.
- Testnet host: banner telling the member to switch to mainnet.
- Bad phone number refused, consent box required.
- Pot planner sliders update the pot, cycle and your turn date, and prefill the start form; tab bar reaches Home, Chamas, Me and Help; FAQ opens and closes.
- Invite QR code and link; changing where you are paid and leaving while the chama is forming.
- After a delivered share: Receipts tab lists the M-Pesa receipt, Activity tab shows the timeline, Me shows paid/received and 100% on time, the recipient sees their turn collecting.
- First screen copy and buttons, Swahili toggle and Swahili from the host language, demo chama payment with receipt, staked reserve meter + default validator + stake, and no sideways scroll on any screen at 360 px.

## Live partner endpoints (read-only)

| Check | Result |
| --- | --- |
| Live quotes vary by amount: KSh 20 came to 1.5% over the published rate, KSh 1,000 to about 1% (the partner's spread is not a fixed percentage) | measured |
| `GET bitcoin.co.ke/.well-known/lnurlp/254712345678` resolves a phone | pass: KES currency, min 15, max 50,000, multiplier 10,443 msats/KES |
| Fetch a live invoice for KES 20 (not paid) | pass: `lnbc2120n…`, `converted: 20`, 212,000 msats (1.5% over rate), 120 s expiry, description names the phone, receipt URL returned |
| Validate that invoice with Zamu's validator | pass (unit test uses this exact invoice) |
| `GET api.tando.ltd/v1/transactions/btcpay/payment-hash/<hash>` | pass: unknown hash returns `transaction-not-found`, mapped to pending |

## Deployed stage (AWS, ap-south-1)

`npx tsx scripts/smoke.ts <url>` runs over HTTPS with real Nimiq keys and moves no money. Against the dev stage (Lambda + API Gateway + RDS):

| Check | Result |
| --- | --- |
| `/api/health`: database reachable, `AUTH_SECRET` and `CRON_SECRET` present | pass |
| `/`, `/demo`, `/start`, `/join`, `/reserve`, icon, share image over HTTPS | pass (about 0.2 s warm) |
| Sign in with a Nimiq signature; a key only ever signs in as its own address; garbage signature refused | pass |
| Create chama, preview by code without phones, join, outsider refused, lock order | pass |
| Both members sign the agreement; round 1 opens; other members see the recipient masked; signed agreement re-verifies | pass |
| Live payout invoice from the partner through the deployed app (KSh 20 → 213 sats), same invoice on a second tap, status "issued", recipient cannot pay their own turn | pass |
| Cron route refuses no secret and a wrong secret (401) | pass |
| Scheduled job runs every 5 minutes and pings the site | pass (`{"msg":"tick","opened":0,"checked":0,…,"ping":200}`) |
| Database migrations applied (from inside AWS, `zamu-<stage>-migrate`) | pass |
| Validator list and default (`Garuda Pool`) | pass |

Total: 35/35 on dev and 35/35 on production (now also `/chamas`, `/me`, `/help`, `GET /api/me`, and leaving refused once the order is fixed) at https://zamu.prashantthakur.dev (TLS certificate issued by Amazon, valid to May 2027).

Also on production: the Playwright screen tests (first screen, Swahili, demo chama payment, no sideways scroll at 360 px) pass, 4/4; outside Nimiq Pay the app shows "Open Zamu inside Nimiq Pay" and offers no mock sign-in; no console errors.

## Bugs found by testing and fixed

- A non-numeric `currencyAmountSent` from the partner became `NaN` and broke the delivered update. Now parsed defensively.
- When the last member paid, the round closed and the pay sheet vanished before they saw their receipt. The sheet now stays bound to the round it opened for.
- The AWS bundle was built with the local mock-wallet switch from `.env.local` compiled in, which removed the real Nimiq Pay path. The build now clears the mock switches, refuses to ship a bundle that contains the mock path, and the mock can only turn on for localhost/LAN addresses and never on Lambda.
- On desktop the app now sits in a phone frame beside a pitch panel (what Zamu is, a QR code to open it in Nimiq Pay, the demo). Desktop e2e first failed because buttons scrolled under the floating tab bar; the frame now scrolls in its own area with the tab bar as a solid footer.
- A React hydration error (#418) on the live site: the pot planner and the demo chama rendered dates with the server's clock. They now render after the page loads; the live site shows no console errors at 390, 1440 and 1920 px.
- The new tab bar sat above bottom sheets and covered their buttons (caught by e2e); it now shares the sheets' stacking context.
- "Agreement signed by n/total" moved out of sight when tabs were added; it is back in the chama header.
- Database migrations could not run from a developer machine whose network blocks port 5432; they now run from a Lambda inside AWS.

## On a real phone, inside Nimiq Pay (mainnet)

Recorded on an Android phone on 11 Nov 2026 (the film's phone shots come from this recording):

| Check | Result |
| --- | --- |
| Open from Nimiq Pay → Mini Apps (Custom URL / Discover search) | pass |
| Sign in: Nimiq Pay's Connect prompt, then its Sign Message prompt showing "Sign in to Zamu" with the server's nonce; the server verified the signature and signed the member in | pass: real `nimiq.sign()` signatures verify on the server |
| Create a chama with an M-Pesa payout; KSh 10 refused with "A share must be between KSh 15 and KSh 50,000", then KSh 20 accepted | pass |
| Invite screen: code, QR code, copy link; "You need at least 2 members to start" | pass |
| Home, planner, Help, tab bar, the phone's dark theme | pass |
| Demo chama: Pay → invoice → Sent → Delivered with the M-Pesa receipt | pass |

Note: Nimiq Pay's QR scanner only opens Mini Apps that are listed in its directory. Until listing opens, Zamu is opened by typing the address in Mini Apps → Custom URL.

## Real-money test (to run once, by hand)

Goal: 1–3 real mainnet payouts of KSh 15–50 to a tester's Safaricom number, paid with NIM from Nimiq Pay.

You need two phones with Nimiq Pay on **mainnet** (Settings → network), each with a little NIM (KSh 50 is about 1,500 NIM; keep 3,000 for fees and the swap), and one Safaricom number that will receive.

1. Phone A (the recipient): open `Nimiq Pay → Mini Apps → Custom URL → zamu.prashantthakur.dev`, sign in, **Start a chama**: name "Proof 1", share KSh 20, every day, 2 members, payout M-Pesa with the tester's number, tick consent, create.
2. Phone B: **Join with a code** using the code from A, any payout method, tick consent, join.
3. Phone A: **Fix the order** (A first). Both phones: **Sign with Nimiq Pay**. Round 1 opens with A receiving.
4. Phone B: **Pay KSh 20**. Nimiq Pay asks to allow invoice lookup, choose NIM, and approve the swap. Approve. The sheet shows "Sent. Waiting for M-Pesa…".
5. Watch: the sheet polls every 3 s. Within about a minute it should show "Delivered to …'s M-Pesa" with the receipt code. The tester's phone gets the M-Pesa SMS; the code must match.
6. Open **View M-Pesa receipt** and check the partner's receipt page shows the same amount and code.
7. Optional: repeat with KSh 15 and KSh 50, and a second chama where B receives, to get three data points.

What to watch in the logs (AWS console → CloudWatch → log group `/aws/lambda/zamu-production-web`): `POST /api/rounds/<id>/invoice` (200), `POST /api/invoices/<id>/submitted` (200), then `GET /api/invoices/<id>/status` every 3 s. Any `[zamu] unhandled route error` line is a bug. The scheduled job logs `{"msg":"tick",…}` every 5 minutes under `/aws/lambda/…Tick…`; after a delivery it shows `delivered` counts.

If something stalls: the share shows Paying or Checking and never Paid, which is correct; the scheduled job keeps checking for 24 hours. If the partner reports a failure, the share shows Failed with the payment hash; email support@tando.me with that hash.

Afterwards, fill the numbers:

```bash
DATABASE_URL="$(npx sst shell --stage production -- printenv DATABASE_URL)" npx tsx scripts/proof.ts
```

That writes `PROOF.md`. Copy its first table into the README "Numbers" section and update the verified line in `SUBMISSION.md`.
