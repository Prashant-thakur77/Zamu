import { NextResponse } from 'next/server'
import { ZamuError } from './errors'
import { getSessionAddress } from './session'

/** Every member route needs a verified Nimiq address. */
export async function requireAddress(): Promise<string> {
  const address = await getSessionAddress()
  if (!address) throw new ZamuError('Sign in first.', 401, 'signin')
  return address
}

export async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ZamuError('Expected a JSON body.')
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZamuError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error('[zamu] unhandled route error:', error)
  return NextResponse.json({ error: 'Something went wrong on our side. Try again.' }, { status: 500 })
}

/** Wrap a route handler so every error becomes a JSON reply with a next step. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (error) {
      return errorResponse(error)
    }
  }
}
