/**
 * Messages members send each other over WhatsApp or SMS. Nimiq Pay offers mini
 * apps no push channel, so the group chat these chamas already run on is the
 * channel; the native share sheet sends it.
 */

export function miniAppLink(origin: string): string {
  const host = origin.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://nimpay.app/miniapps/open/${host}`
}

export function kes(amount: number): string {
  return `KSh ${amount.toLocaleString('en-US')}`
}

export function buildInviteMessage(params: { chamaName: string; shareKes: number; frequency: string; code: string; link: string; lang?: 'en' | 'sw' }): string {
  if (params.lang === 'sw') {
    return [
      `Jiunge na chama "${params.chamaName}" kwenye Zamu.`,
      `Mchango: ${kes(params.shareKes)} ${params.frequency}. Zamu yako ikifika, pesa inaingia M-Pesa yako moja kwa moja.`,
      '',
      `Nambari ya mwaliko: ${params.code}`,
      `Fungua kwenye Nimiq Pay: ${params.link}`,
    ].join('\n')
  }
  return [
    `Join our chama "${params.chamaName}" on Zamu.`,
    `Share: ${kes(params.shareKes)} ${params.frequency}. When it's your turn, everyone's share lands straight in your M-Pesa.`,
    '',
    `Invite code: ${params.code}`,
    `Open in Nimiq Pay: ${params.link}`,
  ].join('\n')
}

export function buildNudgeMessage(params: {
  chamaName: string
  shareKes: number
  recipientName: string
  dueAt: string
  outstanding: string[]
  url: string
  lang?: 'en' | 'sw'
}): string {
  const { chamaName, shareKes, recipientName, dueAt, outstanding, url } = params
  const dueLabel = new Date(dueAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  const who = outstanding.length === 1 ? outstanding[0] : `${outstanding.length} people`
  if (params.lang === 'sw') {
    return [
      `${chamaName}: ${who} bado ${outstanding.length === 1 ? 'hajalipa' : 'hawajalipa'} ${kes(shareKes)}`,
      `kwa ${recipientName}, mwisho ${dueLabel}.`,
      '',
      `Lipa hapa: ${url}`,
    ].join('\n')
  }
  return [
    `${chamaName}: ${who} still ${outstanding.length === 1 ? 'owes' : 'owe'} ${kes(shareKes)}`,
    `to ${recipientName}, due ${dueLabel}.`,
    '',
    `Pay here: ${url}`,
  ].join('\n')
}

export interface ShareResult {
  ok: boolean
  method: 'share' | 'clipboard' | 'none'
}

/** Native share sheet on a phone, clipboard otherwise. */
export async function shareText(text: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return { ok: true, method: 'share' }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return { ok: false, method: 'share' }
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return { ok: true, method: 'clipboard' }
    } catch {
      // fall through
    }
  }
  return { ok: false, method: 'none' }
}
