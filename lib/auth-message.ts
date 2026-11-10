/**
 * The sign-in text. Shared by client and server so the server can rebuild it
 * exactly; the nonce inside is server-issued and single-use.
 */
export function buildAuthMessage(params: { address: string; nonce: string; issuedAt: string }): string {
  return [
    'Sign in to Zamu',
    '',
    'This proves you own this Nimiq address. It is free and sends no money.',
    '',
    `Address: ${params.address}`,
    `Nonce: ${params.nonce}`,
    `Issued: ${params.issuedAt}`,
  ].join('\n')
}
