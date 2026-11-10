import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Nimiq from '@nimiq/core'
import {
  addressFromPublicKey,
  isValidNimAddress,
  signedMessageHash,
  verifyNimiqMessage,
} from '../../lib/nimiq-sig'

test('derives the same address as the Nimiq core library', () => {
  for (let i = 0; i < 5; i += 1) {
    const kp = Nimiq.KeyPair.generate()
    assert.equal(addressFromPublicKey(kp.publicKey.toHex()), kp.toAddress().toUserFriendlyAddress())
  }
})

test('verifies a signature made the way Nimiq wallets sign messages', () => {
  const kp = Nimiq.KeyPair.generate()
  const address = kp.toAddress().toUserFriendlyAddress()
  const message = 'Zamu agreement — KSh 1,000 ✓'
  const signature = Nimiq.Signature.create(kp.privateKey, kp.publicKey, signedMessageHash(message)).toHex()
  const publicKey = kp.publicKey.toHex()

  assert.ok(verifyNimiqMessage({ message, publicKey, signature, expectedAddress: address }))
  assert.ok(!verifyNimiqMessage({ message: message + '.', publicKey, signature, expectedAddress: address }))

  const other = Nimiq.KeyPair.generate().toAddress().toUserFriendlyAddress()
  assert.ok(!verifyNimiqMessage({ message, publicKey, signature, expectedAddress: other }))
  assert.ok(!verifyNimiqMessage({ message, publicKey, signature: 'zz', expectedAddress: address }))
})

test('validates address checksums', () => {
  assert.ok(isValidNimAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000'))
  assert.ok(!isValidNimAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0001'))
  assert.ok(!isValidNimAddress('hello'))
})
