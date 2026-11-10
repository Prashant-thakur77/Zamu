# Zamu: submission text

**Category:** Save

When it's Wanjiru's turn in her chama, your share lands in her M-Pesa, in exact shillings, and the whole group sees the receipt.

Zamu is a chama (a Kenyan rotating savings group) that runs inside Nimiq Pay. Members agree a share, an order and a schedule, and each one signs that agreement with their Nimiq key. Every round, each member taps Pay. Nimiq Pay swaps their NIM or USDT to Lightning with `payLightningInvoice()`, and a Kenyan payout partner delivers shillings to the recipient's phone. A share counts as paid only when the M-Pesa receipt code comes back, and everyone can open it.

It is for Kenyan and diaspora chama members. The person receiving needs nothing but M-Pesa. Members abroad can receive to a Lightning address or a Nimiq wallet instead.

Nobody holds the pot, so there is no treasurer to trust. An optional rule skips a member's turn until they have paid every share due, and each member's on-time record is visible. Members can keep NIM staked for their next shares and get told when to unstake.

What we verified: Zamu runs on mainnet inside Nimiq Pay on a phone, where sign-in is a real nimiq.sign() signature checked by the server. A live payout quote for KSh 1,000 cost 1% over the partner's published rate. 35 live checks and 59 automated tests pass. Real payouts are next, and every number will come from our proof script.

Limits: members need NIM or USDT first; payouts go to phone numbers only (no Paybill or Till); the minimum share is KSh 15; the partner holds funds for seconds between Lightning and M-Pesa.
