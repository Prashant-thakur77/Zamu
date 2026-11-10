# Zamu: design brief

**Subject.** A chama (Kenyan rotating savings group) run inside Nimiq Pay. Every round one member's turn comes ("zamu yako"); everyone else's share lands straight in that member's M-Pesa in exact shillings, and the whole group sees each M-Pesa receipt. Nobody holds the pot; no treasurer.

**Audience.** Kenyan chama members (market traders, office groups, church and family groups, boda riders) and the diaspora who pay into family chamas. Judges of the Nimiq Mini Apps Competition opening it inside Nimiq Pay, often outside Kenya.

**One job.** Get a group from "we already run a chama on WhatsApp" to "the shares now arrive in M-Pesa on their own, with receipts" in under a minute.

**Primary CTA.** Start a chama. Secondary: Join with a code. Tertiary (judges): Try a demo chama.

**The subject's world.**
- Materials: M-Pesa confirmation SMS ("QJK7T2… Confirmed. Ksh1,000.00 received from…"), Safaricom green, paper receipt books, a treasurer's ruled exercise book with names and ticks, kanga cloth borders and their printed Swahili proverbs, matatu sign-writing, ankara/kitenge pattern, the round table of a chama meeting, rubber stamps.
- Motion: a baton or envelope passed around a circle; the "zamu" moving seat to seat; a stamp coming down; an SMS sliding in; coins dropping into a tin.
- Sound: the M-Pesa SMS tone, a stamp thud (not used: no sound in a wallet WebView).

**Dials.** CRAZINESS 6 (it lives inside a wallet; the board must stay instantly legible), MOTION 6, DENSITY 4.

**Hard constraints.** Next.js 16 App Router + Tailwind v4, runs in the Nimiq Pay WebView (360-430 px wide, safe areas, no hover), English + Swahili, 16 px inputs (no iOS zoom), every state has a next step, works without animation, no heavy WebGL. Deadline Nov 11 2026 23:59 UTC.
