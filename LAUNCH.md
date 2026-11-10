# Launch posts

## X

Your chama, paid straight to M-Pesa.

Zamu runs in Nimiq Pay: members tap Pay, NIM or USDT goes over Lightning, and the shillings land in whoever's turn it is. No treasurer.

My Nimiq Mini Apps Competition entry (Save).

https://youtu.be/l7_HeIk76Ig

## Skool

**Zamu: a chama that pays straight to M-Pesa (Nimiq Mini Apps Competition, Save)**

Hi all. I built Zamu for the Nimiq Mini Apps Competition.

A chama is a rotating savings group: everyone puts in the same amount each week or month, and one person takes the whole pot each round until everyone has had a turn. In Kenya they run on trust, a WhatsApp group and one treasurer who holds the cash.

Zamu takes the treasurer out. Inside Nimiq Pay, each member taps Pay on their share. Nimiq Pay pays a Lightning invoice with NIM or USDT (`payLightningInvoice`), and the shillings arrive in the recipient's M-Pesa. A share only shows as paid when the M-Pesa receipt code comes back, and the whole group can open every receipt.

Other bits:
- everyone signs the chama agreement (order, amount, schedule) with `nimiq.sign()`, verified on the server
- an optional rule skips a member's turn until they've paid everything they owe
- on-time records for each member
- keep NIM staked for your next shares, with a reminder to unstake before pay day
- English and Swahili
- a demo chama for anyone outside Kenya, no money involved

Open it in Nimiq Pay: Mini Apps → Custom URL → zamu.prashantthakur.dev
Video: https://youtu.be/l7_HeIk76Ig
Code (MIT): https://github.com/Prashant-thakur77/Zamu

Feedback very welcome, especially from anyone who's in a chama.

## Published

- X: https://x.com/2730Thakur12618/status/2120233985637060966
- Skool: https://www.skool.com/miniappscompetition/zamu-a-chama-that-pays-straight-to-m-pesa-save?p=8f616483
- Video: https://youtu.be/l7_HeIk76Ig
