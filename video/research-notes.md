# Zamu demo film: research notes

Collected 2026-11-10. Only things actually seen are listed. Where something could not be confirmed it says so.

## 1. Past winners (Cycle 1 and Cycle 2)

Sources:
- Cycle 1 results: https://www.nimiq.com/blog/mini-apps-competition-cycle-1-winner-announcement/
- Cycle 2 results: https://www.nimiq.com/blog/mini-apps-competition-cycle-2-winner-announcement/ and https://www.skool.com/miniappscompetition/cycle-2-winners-are-here
- Video links come from each winner's `submission.yaml` in https://github.com/nimiq/miniappscompetition-submissions (folders `cycle1/<login>`, `cycle2/<login>`). That repo has **no `winner` label**; no PR carries one.
- Titles confirmed with YouTube oEmbed. Length, upload date and description came from the public watch-page metadata (yt-dlp `-j`, no download). First lines come from YouTube auto-captions. Visual notes come from YouTube's public storyboard thumbnails, about 1 frame per second (about 1 per 2 s for Knock). I did not watch the full video or hear the audio, so "music only" means YouTube's captions found no speech.
- x.com/miniappscomp returned HTTP 402 and could not be read.

Cycle 1: 62 submissions, $17k pool. Cycle 2: 142 submissions; the $17k pool was split 7k / 4k / 4k / 2k because 2nd place was shared.

| Cycle | Place | App (builder) | What it does | Prize | Video |
|---|---|---|---|---|---|
| 1 | 1st | **Nimiq Space** (@Harlski) | Multiplayer isometric social world; wallet-signed players build together, pixel floor, seasonal soccer | $10,000 | https://youtu.be/QWzrXwbqHvs "Nimiq Space Intro" |
| 1 | 2nd | **NimJump** (@emrealt34) | Godot arcade jumper; leaderboards, streaks, server-verified replays to stop cheating | $5,000 | https://youtube.com/shorts/JklwqY97iUI "Earn By Playing Just That Easy" |
| 1 | 3rd | **NimQuest** (@mystiquemide) | Learn-and-prove: lesson, server-graded quiz, Nimiq Pay wallet signature as proof; no NIM moves | $2,000 | https://youtu.be/iSwB3MyyLZM "NimQuest" |
| 2 | 1st | **Knock** (@kaichaosun) | Encrypted chat where strangers pay a set NIM cost to reach you; NIM transfers and gifts, group chats | $7,000 | https://youtu.be/DSgO3qT8pIU "Knock chat: for friends, family and community - not for spam." |
| 2 | 2nd (shared) | **Blacktop** (@Jayobebe) | Motorcycle ride companion; crew fuel pot paid out only on unanimous vote, QR tips in NIM/USDT | $4,000 | https://youtu.be/IAYky-1sZzw "blacktop demo vid" |
| 2 | 2nd (shared) | **NIMIQ.kids** (@Andjroo111) | Family chore economy; parent approves a task and NIM goes to the child's own account; 5 languages | $4,000 | https://youtu.be/Aobwj-1cBdk "Nimiq kids: a mini economy for your family" |
| 2 | 3rd | **PROOF** (@LegendaryTunzeverywhere / nimiqagent) | AI learning: uploaded docs become curricula and quizzes; earn NIM for proving skills | $2,000 | https://youtu.be/IYAdBWNSW-A "PROOF DEMO - LEARN IT, PROVE IT, EARN IT" |

### Video breakdown

| Video | Length | Product on screen | Opening | Narration | Inside Nimiq Pay on a phone? |
|---|---|---|---|---|---|
| Nimiq Space (C1 1st) | 0:59 | 0 s (gameplay from frame 1) | No speech. Gameplay with the caption "Earn NIM with a single click", then "Spend NIM with a single click" and "Welcome to Nimiq Space" | No speech found (music only, presumably) | Gameplay shown in a vertical phone-shaped frame over a blurred background. End card says "Explore Nimiq Space On Nimiq Pay" then "On Desktop & Mobile". Nimiq Pay app chrome not confirmed |
| NimJump (C1 2nd) | 0:20 (Short, vertical) | 0 s | No speech. Gameplay with captions | No speech found | Vertical screen recording of the game and its menus; Nimiq Pay chrome not confirmed |
| NimQuest (C1 3rd) | 1:05 | About 0 s for app-styled animated cards; title "Learn Nimiq. Prove it." at about 6 s; real product screens (desktop plus phone mockup) at about 16 s | "Most crypto learning ends with a tab closed and nothing proven." | Voice-over (captioned on screen) | No. Device mockups on a designed background; ends on a "Learn Nimiq by doing." card |
| Knock (C2 1st) | 3:13 (vertical) | 0 s | Opens straight on the Nimiq Pay wallet home screen ($0.04 balance), then taps through the Mini Apps banner into Knock, with red circles marking each tap | Music only (captions show only "[music]") | **Yes.** Raw phone screen recording inside Nimiq Pay |
| NIMIQ.kids (C2 2nd) | 1:11 | About 17 s (tablet UI); the first ~16 s are problem shots (photos of a messy floor, a kid on a tablet) | "Getting a kid to do their chores is hard." then "Keeping an eye on screen time is harder." | Voice-over plus music, burned-in captions | No. Tablet mockups; ends on an emotional shot ("Everyone reaching their goals. Together.") and a logo card |
| Blacktop (C2 2nd) | 18:19 | Not checked | "Uh well, hello. I'm Jesse and I am the creator of Blacktop." | Live voice, unscripted | Not checked |
| PROOF (C2 3rd) | 4:15 | Not checked | "This video illustrates the process of setting up your wallet and exploring the learning features within the Proof app." | Voice plus music | Not checked |

### Shared patterns
- **Length:** no length norm. Winners ran from 20 s to 18 min. The three most polished videos (Nimiq Space, NimQuest, NIMIQ.kids) are all 59-71 s.
- **Fast product:** 4 of 5 checked videos show the product (or product-styled UI) within the first 6 s. The slowest is NIMIQ.kids at about 17 s, which spends that time on a problem montage.
- **Story-led openings win too:** both narrated, scripted videos (NimQuest, NIMIQ.kids) open with a one-line pain statement ("Most crypto learning ends with...", "Getting a kid to do their chores is hard.") and then name the product.
- **Captions on screen:** every short video has burned-in captions or text cards, so it can be watched muted.
- **Inside Nimiq Pay:** only Knock clearly shows the real Nimiq Pay app on a phone (wallet home, Mini Apps entry, then the app). Nimiq Space says "On Nimiq Pay" in text. Others use mockups.
- **Video quality was not decisive:** Knock (1st, Cycle 2) is a 3-minute raw screen recording with music. Blacktop (2nd) is an 18-minute unscripted walkthrough. The Council judges the app; the video only has to show it working.
- **End cards:** product name plus where to get it ("Explore Nimiq Space On Nimiq Pay", "Learn Nimiq by doing.", NIMIQ.kids logo).
- **Money moving:** the Cycle 2 winners all move NIM between people (pay to connect, crew fuel pot, chore payouts, learn-to-earn). Blacktop's "fuel pot paid out only on unanimous vote" is the closest thing to a group pot.

## 2. Chama facts (Kenya)

**Scale (primary, recent):** In the 2024 FinAccess Household Survey (Central Bank of Kenya, KNBS and FSD Kenya, December 2024), informal groups (ASCAs, ROSCAs and chamas) had **8.7 million adult users in 2024, up from 7.8 million in 2021**. Exact wording: "Informal groups also held significant appeal, rising from 7.8 million users in 2021 to 8.7 million in 2024". The same report gives informal group membership as **30.7 percent** of adults.
Source: https://www.centralbank.go.ke/wp-content/uploads/2024/12/2024-FINACCESS-HOUSEHOLD-SURVEY-MAIN-REPORT.pdf (section 3.2 and Fig. 3.2; read from the PDF text)
- Same report, consumer protection: "new concerns emerged for Chama/groups, with 28.9 percent of users reporting unexpected charges in 2024."

**Scale (older, assets):** "There are currently an estimated 300,000 groups that collectively hold an asset base of more than Sh300 billion." The Standard, 4 June 2013: https://www.standardmedia.co.ke/amp/article/2000085163/chama-revolution-banks-train-sights-on-investment-clubs. The figure is from 2013; use it only with the year.

**How they're run / trust and theft:**
- K24 Digital, 9 July 2026, "How to spot Chama fraud before your hard-earned savings vanish": "This occurs when a treasurer or a small clique of members quietly mismanages group money." Also: "many informal groups operate entirely on trust rather than clear structures", and the advice that "financial control does not lie with a single individual". https://k24.digital/lifestyle/money/how-to-spot-chama-fraud-before-your-hard-earned-savings-vanish
- A specific case: Bizna Kenya, 15 Dec 2022. The treasurer of Simba Miritini Apparels, a Mombasa chama, "transferred the money from the real Chama account to her personal mobile money account" (Sh 163,000 in end-of-year savings). https://biznakenya.com/mombasa-chama/

## 3. How Nimiq frames Nimiq Pay, Lightning and Mini Apps

- "Nimiq Pay is the payment-focused mobile app" / "pay with NIM in all locations where the Bitcoin Lightning Network is accepted" (14 June 2024): https://nimiq.com/blog/pay-with-nim-everywhere-lightning-network-is-accepted
- "Mini apps are applications that run directly inside Nimiq Pay" / "every sensitive action goes through a native confirmation dialog" / "Mini apps are now live in the Nimiq Pay app" (April 2026): https://nimiq.com/blog/mini-apps-framework
- "lightweight web apps that run inside Nimiq Pay" / "Every Mini App built on the framework is a new reason to open Nimiq Pay." / "The framework handles wallets, transactions, and payments.": https://www.nimiq.com/blog/mini-apps-competition-cycle-1-winner-announcement/
- Cycle 3 call (Oct 14): "Nimiq Pay is made for payments." Save category: "Extend what a user can hold: a different currency, tokenized gold, bitcoin, or yield-bearing dollars." The strongest Mini Apps give users "real independence over their own money." This page lists no judging criteria and no video rules. https://www.nimiq.com/blog/mini-apps-competition-cycle-3-announcement/
- Executive Director Max Burger, in a press release: "This is an 'App Store moment' for crypto payments". https://cryptoslate.com/press-releases/nimiq-opens-second-mini-apps-competition-after-strong-debut/
