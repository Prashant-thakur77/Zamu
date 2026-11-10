# Zamu design system

## Taste (read first)

IS: **grounded** (heavy condensed type, solid fills, money has weight), **communal** (names before numbers; the ring of members is the hero), **exact** (shillings to the shilling, receipt codes in mono, Paid means delivered).

NEVER: crypto-casino (neon, glow, charts), bank-corporate (navy dashboards, tiny grey legalese), charity-poster (pity, "empowering the unbanked").

Feel in motion: heavy and precise, like a rubber stamp. Quick in, firm settle. The turn moving around the ring is slow and deliberate. Only the PAID stamp overshoots.

Material: matte paper with grain, printed kanga borders, ruled treasurer's-book rows, M-Pesa SMS receipts, hard ink offset shadows like sign-writing.

Lines not to cross: no wallet addresses as primary labels; green only for delivered money (never "submitted"); no celebration on someone else's debt; no animation that delays the amount or the status.

## Tokens (`app/globals.css`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | #f3ecdf | #16110c | page |
| `--card` | #fbf7ef | #1d1610 | raised surfaces |
| `--rule` | #d6c8b1 | #3a2f24 | hairlines, ruled rows |
| `--ink` / `--ink-2` / `--ink-3` | #1d1712 / #5a4e42 / #8a7b6a | #f3ead9 / #c4b49c / #8c7c67 | text |
| `--leaf` / `--leaf-bg` | #127a3a / #dcefd9 | #4cc46b / #123620 | delivered money only |
| `--sun` / `--sun-bg` | #f0ac16 / #fbe7b5 | #f5b83a / #3d2d0c | the turn, focus ring, primary highlight |
| `--clay` / `--clay-bg` | #b0402c / #f4d9cf | #ef8a73 / #3d1a12 | failed, overdue, errors |
| `--press` | ink | paper | primary buttons |

Type: Archivo (variable width) for display, set as `.signwrite` (62% width, 900, caps, line-height 0.88) for headlines and amounts, 88% width elsewhere; Instrument Sans for body; JetBrains Mono for receipt codes, dates and hashes. All Google Fonts (OFL). Money uses tabular figures (`.num`) and the `Kes` component (small raised "KSh").

Radius by hierarchy: 4 px ledger bands, 10 px inputs/buttons/notices, 12–14 px cards, 18 px sheet top, full for avatars and chips. Hard shadow `.shadow-hard` (3 px offset ink, 1.5 px ink border) for cards that should feel printed; buttons use a 3 px bottom shadow that collapses on press.

Spacing: 4 px base; screen gutter 16 px; sections 32 px apart.

## Motion

| Name | Duration | Easing | Use |
| --- | --- | --- | --- |
| snap | 180 ms | `--ease-firm` cubic-bezier(.3,.7,.1,1) | button press, radio fills |
| firm | 260 ms | `--ease-firm` | fades |
| slide | 340 ms | `--ease-firm` | sheet up, notices slip up |
| turn | 1000 ms | `--ease-turn` cubic-bezier(.19,1,.22,1) | ring rotates to the next recipient |
| stamp | 220 ms | `--ease-stamp` cubic-bezier(.34,1.56,.64,1) | PAID stamp, the only overshoot |
| print | 240 ms | steps(8) | receipt slip prints in |
| coin | 900 ms | cubic-bezier(.65,0,.25,1) | coin travels payer → recipient |

Reduced motion: every animation and transition drops to 1 ms; the ring is static (the home ring shows a fixed mid-round state); spinners keep turning slowly.

## Signature moment: the Zamu ring (`components/zamu-ring.tsx`)

Members sit around a dotted table circle in rotation order. The recipient's seat is turmeric, larger, at 12 o'clock, with a slow pulse. When a share is delivered, a green coin travels from the payer's seat to the recipient (900 ms) and a green chord stays drawn; the payer's seat gets a leaf tick. When the turn passes, the whole ring rotates (1000 ms, expo out) to bring the next seat to the top, while seat labels counter-rotate to stay upright. The pot total sits in the centre. On the home screen the ring plays a chama on its own; on the board it reflects live data polled every 3 s.

## Components

- `TopBar`: wordmark or Back, language toggle in plain view, sign out.
- `KangaBand`: printed diamond-and-dot hem, optional Swahili proverb panel (footer, sheet top).
- `Button`: press (ink), sun, paper (outlined), ghost (underlined link).
- `StatusChip`: Not paid / Paying / Checking / Paid / Failed, with spinner, tick or bang.
- `ReceiptSlip`: M-Pesa SMS format, green header with the code, PAID stamp.
- `Sheet`: bottom sheet with kanga top edge, Escape and backdrop close.
- Ledger: rounds as stacked folder bands, recipient's name on the tab, open round in turmeric.
- How-it-works: three numbered cards hung on a thread at slight angles.
