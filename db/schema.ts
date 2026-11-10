import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Zamu's schema.
 *
 *  - Identity is a Nimiq address, stored in its spaced user-friendly form
 *    ("NQ07 0000 …"), proven by a signed message at sign-in.
 *  - Shares are whole Kenyan shillings. Lightning amounts are msats/sats,
 *    NIM amounts are Luna (1 NIM = 100,000 Luna).
 *  - A share's state lives on its invoice row; there is exactly one per member
 *    per round, and it is never replaced once it may have been paid.
 */

export const frequencyEnum = pgEnum('frequency', ['daily', 'weekly', 'biweekly', 'monthly'])
export const chamaStatusEnum = pgEnum('chama_status', ['forming', 'signing', 'active', 'completed', 'cancelled'])
export const roundStatusEnum = pgEnum('round_status', ['upcoming', 'open', 'complete'])
export const payoutMethodEnum = pgEnum('payout_method', ['mpesa', 'lightning', 'nim'])
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'issued',
  'submitted',
  'checking',
  'delivered',
  'failed',
  'expired',
])

export const users = pgTable('users', {
  address: text('address').primaryKey(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chamas = pgTable(
  'chamas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Each member's share per round, whole KSh. */
    shareKes: integer('share_kes').notNull(),
    frequency: frequencyEnum('frequency').notNull(),
    size: integer('size').notNull(),
    status: chamaStatusEnum('status').notNull().default('forming'),
    creatorAddress: text('creator_address')
      .notNull()
      .references(() => users.address),
    inviteCode: text('invite_code').notNull(),
    /** A member's turn is skipped until they have paid every share due so far. */
    skipUntilPaidUp: boolean('skip_until_paid_up').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('chamas_invite_code_idx').on(t.inviteCode)],
)

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    address: text('address')
      .notNull()
      .references(() => users.address),
    /** The name this member signs the agreement with. */
    displayName: text('display_name').notNull(),
    payoutPosition: integer('payout_position'),
    payoutMethod: payoutMethodEnum('payout_method').notNull().default('mpesa'),
    /** 2547XXXXXXXX / 2541XXXXXXXX. Only ever shown to members of this chama. */
    payoutPhone: text('payout_phone'),
    payoutLightning: text('payout_lightning'),
    payoutNim: text('payout_nim'),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    agreementMessage: text('agreement_message'),
    agreementPublicKey: text('agreement_public_key'),
    agreementSignature: text('agreement_signature'),
    agreementSignedAt: timestamp('agreement_signed_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('members_chama_address_idx').on(t.chamaId, t.address),
    index('members_address_idx').on(t.address),
  ],
)

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    /** Set when the skip-until-paid-up rule moved the original recipient later. */
    skippedAddress: text('skipped_address'),
    opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: roundStatusEnum('status').notNull().default('upcoming'),
    /** Tando's msats-per-KES, fixed for the round so every member converts alike. */
    msatsPerKes: integer('msats_per_kes'),
    /** NIM conversion for NIM payouts, fixed for the round. */
    lunaPerKes: bigint('luna_per_kes', { mode: 'number' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('rounds_chama_index_idx').on(t.chamaId, t.index)],
)

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    member: text('member').notNull(),
    method: payoutMethodEnum('method').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    recipientPhone: text('recipient_phone'),
    recipientLightning: text('recipient_lightning'),
    recipientNim: text('recipient_nim'),
    kes: integer('kes').notNull(),
    sats: integer('sats'),
    msats: bigint('msats', { mode: 'number' }),
    luna: bigint('luna', { mode: 'number' }),
    bolt11: text('bolt11'),
    paymentHash: text('payment_hash'),
    receiptUrl: text('receipt_url'),
    verifyUrl: text('verify_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: invoiceStatusEnum('status').notNull().default('issued'),
    /** Hash Nimiq Pay returned for the NIM/USDT transaction that paid this. */
    nimiqHash: text('nimiq_hash'),
    swapId: text('swap_id'),
    receiptCode: text('receipt_code'),
    kesDelivered: integer('kes_delivered'),
    failureReason: text('failure_reason'),
    recipientConfirmedAt: timestamp('recipient_confirmed_at', { withTimezone: true }),
    tappedAt: timestamp('tapped_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invoices_round_member_idx').on(t.roundId, t.member),
    uniqueIndex('invoices_payment_hash_idx').on(t.paymentHash),
    uniqueIndex('invoices_nimiq_hash_idx').on(t.nimiqHash),
    index('invoices_status_idx').on(t.status),
  ],
)

/** NIM staked as a reserve for future shares. One row per transaction. */
export const stakeEvents = pgTable(
  'stake_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    address: text('address').notNull(),
    kind: text('kind').notNull(), // 'stake' | 'retire' | 'remove'
    luna: bigint('luna', { mode: 'number' }).notNull(),
    validator: text('validator'),
    txHash: text('tx_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stake_events_address_idx').on(t.address)],
)

/** Single-use sign-in nonces. Consumed by DELETE ... RETURNING. */
export const authNonces = pgTable('auth_nonces', {
  nonce: text('nonce').primaryKey(),
  address: text('address').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
