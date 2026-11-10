/**
 * Kenyan M-Pesa numbers.
 *
 * People type them every way: 0712 345 678, +254 712 345 678, 254712345678,
 * 712345678. Safaricom mobile numbers start 7 or 1 after the country code, so
 * that is all we accept: Tando only pays out to phones, not Paybill or Till.
 */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(digits)) return null

  let local: string
  if (digits.startsWith('254')) local = digits.slice(3)
  else if (digits.startsWith('0')) local = digits.slice(1)
  else local = digits

  if (!/^[17]\d{8}$/.test(local)) return null
  return `254${local}`
}

/** "+254 7•• ••• 678": enough to recognise your own number, not enough to dial. */
export function maskPhone(phone: string): string {
  const n = normaliseKenyanPhone(phone) ?? phone
  const local = n.slice(3)
  return `+254 ${local[0]}•• ••• ${local.slice(-3)}`
}

export function formatPhone(phone: string): string {
  const n = normaliseKenyanPhone(phone) ?? phone
  const local = n.slice(3)
  return `+254 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}
