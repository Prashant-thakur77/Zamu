# Direction: "Zamu yako" (your turn)

Style: **Hybrid**. Licensed b-roll of Kenyan everyday money life opens the film under a kanga band; the real app
carries the middle on a phone; the "under the hood" section is built from the app's own paper, ink and kanga
language. Narrator: chosen by audition (see refs/), not the warm female voice of the last film.

## 1. The world: a chama around a table
The film is made of what a chama is: people sitting in a circle, a turn that passes seat to seat, money that moves
from every hand to one hand, and the M-Pesa SMS that proves it arrived. The visual language is the product's own:
matte paper #f3ecdf with grain, chai ink #1d1712, turmeric #f0ac16 for whoever's turn it is, leaf green #127a3a
only for money delivered, clay #b0402c for what's owed, and the printed kanga hem (diamonds and dots) as the
border of every frame. Archivo condensed caps ("sign-writing") for every headline; JetBrains Mono for receipt codes.
Story beats: warm, slightly desaturated real footage. Product beats: crisp paper.

## 2. Signature transition: the turn
At each big section change (story → turn, turn → product, product → under the hood, proof → close) a ring of seats
fades in over the outgoing picture, the turmeric seat lit at the top. The ring **rotates one seat** (1.0 s, expo
out), and as it turns its kanga border expands outward from the centre like an iris, revealing the next scene
inside the ring. It is the app's own "turn passes" motion scaled up to the whole frame. Built frame-driven in
`film/src/scenes/TurnWipe.tsx`. Sound: a single wooden knock on the frame the turn lands.

Other transitions, each with a cause: cut on the tap frame (product), a coin flying from a seat that carries the
camera into the phone, the M-Pesa SMS sliding up into the next scene, fade to the end card.

## 3. The moment people remember
**Every hand to one hand.** A real ring of six members on paper. One by one, a coin leaves each seat, travels the
chord to the lit seat, and the chord stays drawn in green; as each coin lands, an M-Pesa SMS drops onto the
recipient's phone beside the ring with its receipt code, and the pot counter ticks up in KSh. When the last coin
lands, the ring turns one seat and the next member lights up. No treasurer's tin anywhere in the circle: the
centre of the ring is empty except the total.

## 4. Look
Paper and ink with grain, kanga hem top and bottom of title frames, hard 3 px ink offset shadows on cards
(sign-writing), the app's own ring and receipts. Real footage graded warm (lift shadows, -10% saturation) with the
kanga hem as a lower frame. Camera: slow push on footage; on the phone, push-ins to the line the voice names.

## 5. Sound identity
A plucked nylon/kalimba-like motif over soft hand percussion (shaker, a low drum on the turns), warm and
unhurried, lifting for the recap. The turn transition gets a wooden knock; a coin landing gets a soft metallic tick;
the PAID stamp a muted thud. One tune start to end.

## What is new against the last films
Sightline used a parcel/receipt world, an ink-line "register snap" transition and a warm female narrator. Zamu uses
a circular, rotational language (the ring turns), real b-roll of Kenya, a different narrator and a percussion-led
score. Receipts appear only as the product's real M-Pesa slips, never as the transition.

## References looked at (motion moves, not looks)
- Stripe Sessions keynote openers: one object carried across scene changes → here, the coin carries the cut.
- Apple Pay Cash launch film: the money moving between two phones as a single traced arc → here, chords across a ring.
- Kurzgesagt-style circular iris wipes → here, the iris is the kanga ring and it turns one seat as it opens.
