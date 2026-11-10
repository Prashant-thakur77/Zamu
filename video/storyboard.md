# Storyboard: Zamu (~2:25)

First lines considered:
1. A moment: "Every Friday, Wanjiru's chama puts in a thousand shillings each. This week, it's her turn." ← chosen
2. A question: "When it's your turn in the chama, who's holding your money?"
3. A reframe: "Everyone thinks a chama runs on trust. It actually runs on one person's phone."

Spine: Every Friday… (the chama) But today… (one person holds the pot) Because of that (sign → pay → receipt)…
Until finally (the receipt lands, the turn passes) And ever since (Friday again, the buzz, no treasurer).

| # | Beat | Narration (caption spelling) | Picture | Motion | Emphasis | Sound | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Moment | Every Friday, Wanjiru's chama puts in a thousand shillings each. This week, it's her turn. | b-roll: Nairobi market, a woman with a phone (persona label "Wanjiru, persona") | slow push, kanga hem lower frame | "her turn" | motif enters, sparse | persona |
| S2 | Pain | Today, one treasurer collects it all, in cash or on one phone. Everyone has to trust that person. | b-roll: cash counted / hands; label "one treasurer" pinned | push, label pin | "one treasurer" | bed | |
| S3 | Twist + scale | CHAMA_FACT_LINE | kinetic type on paper, the fact as a big number with source | count-up | the number | low drum | research-notes.md |
| S4 | Turn | This is Zamu. Your chama, paid straight to M-Pesa. | TurnWipe → wordmark + tagline | ring turns one seat, iris opens | "straight to M-Pesa" | knock + lift | |
| S5 | Product: start | Inside Nimiq Pay, start a chama: the share, how often, the order. | phone: Start screen filled, live site | phonestep 1, push to share field | share | click | local test (mock wallet) |
| S6 | Product: join | Friends join with a code, and the M-Pesa number their turn gets paid to. | phone: Join with code + consent | phonestep 2 | "M-Pesa number" | click | local test |
| S7 | Product: sign | Then everyone signs the agreement with their own Nimiq key. | phone: agreement + "Agreement signed by 3/3" | phonestep 3, push to signed count | "Nimiq key" | tick | local test |
| S8 | Memorable: every hand to one hand | Each round, members tap Pay. Nimiq Pay swaps their NIM or USDT to Lightning, and our payout partner turns it into exact shillings in Wanjiru's M-Pesa. | ZamuRing world: coins travel seat → lit seat, chords stay green, SMS slips drop beside it, pot counts up | bespoke | "exact shillings" | coin ticks per landing | illustration (labelled "how a round works") |
| S9 | Product: pay | A share only turns green when the M-Pesa receipt comes back, and the whole group can open it. | phone: pay sheet → Sent → Delivered + receipt slip; board chips go Paid | phonestep, push to receipt code | "M-Pesa receipt" | stamp thud | local test, mock partner (label) |
| S10 | Risky case | If Nimiq Pay can't tell whether a payment went out, Zamu never lets you pay twice. It checks, and waits. | phone: "We're checking whether this went through", Pay button gone | push to the notice | "never … twice" | tick | e2e state, local |
| S11 | Rule | And a member who stops paying loses their turn until they catch up. | ledger bands reorder: the skipped member's tab slides back | bespoke ledger move | "loses their turn" | soft whoosh | product rule |
| S12 | Under the hood | Under the hood: Nimiq Pay signs and pays. Zamu checks every invoice: Bitcoin mainnet, the exact amount, the right phone, still alive. The payout partner delivers M-Pesa, and a job on AWS re-checks every five minutes until the receipt arrives. | arch3d stack in paper/ink/kanga: Nimiq Pay → Zamu checks → Lightning → payout partner → M-Pesa; satellites: AWS Lambda, Postgres, 5-min job | slabs rise on the words | "every invoice" | slab ticks | sst.config.ts, lib/lightning.ts |
| S13 | Proof | On a live quote today, the payout leg cost PROOF_SPREAD over the partner's own rate. | proof: live invoice for KSh 1,000: sats vs rate, spread; baseline World Bank 8.46% (labelled "full remittance, not comparable 1:1") | bars | the spread | hit | facts.json (live, at render) |
| S14 | Honest limit | Real payouts are next, and every number will come from our proof script. | PROOF.md placeholder, scripts/proof.ts code | code type-on | "proof script" | | repo |
| S15 | Recap | Shares land in M-Pesa, not a group wallet. Paid means a receipt, not "sent". Everyone signs with Nimiq. Fall behind, lose your turn. No treasurer holds the pot. | kinetic lines, one per hit, on paper with kanga hem | riser into line 1 | each line's key word | lift | all shown above |
| S16 | Close | Friday again. Wanjiru's phone buzzes: five thousand shillings, and a receipt for every share. | ring turns to the next seat; a phone with the SMS stack; callback to S1 b-roll | TurnWipe in reverse | "a receipt for every share" | swell, resolve | demo chama |
| S17 | End card | Zamu. Open it in Nimiq Pay. | wordmark, zamu.prashantthakur.dev, nimpay.app link, GitHub | breathes | | chime | |

Labels on screen: "persona" on Wanjiru; "local test · mock wallet and payout partner" on S5–S10 takes;
"illustration" on S8; "live quote, not paid" on S13; "demo chama, no money" on the close phone.
