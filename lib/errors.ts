/** An error whose message is safe and useful to show the person. */
export class ZamuError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message)
  }
}
