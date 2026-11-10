CREATE TYPE "public"."chama_status" AS ENUM('forming', 'signing', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('issued', 'submitted', 'checking', 'delivered', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('mpesa', 'lightning', 'nim');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('upcoming', 'open', 'complete');--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"share_kes" integer NOT NULL,
	"frequency" "frequency" NOT NULL,
	"size" integer NOT NULL,
	"status" "chama_status" DEFAULT 'forming' NOT NULL,
	"creator_address" text NOT NULL,
	"invite_code" text NOT NULL,
	"skip_until_paid_up" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"member" text NOT NULL,
	"method" "payout_method" NOT NULL,
	"recipient_address" text NOT NULL,
	"recipient_phone" text,
	"recipient_lightning" text,
	"recipient_nim" text,
	"kes" integer NOT NULL,
	"sats" integer,
	"msats" bigint,
	"luna" bigint,
	"bolt11" text,
	"payment_hash" text,
	"receipt_url" text,
	"verify_url" text,
	"expires_at" timestamp with time zone,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"nimiq_hash" text,
	"swap_id" text,
	"receipt_code" text,
	"kes_delivered" integer,
	"failure_reason" text,
	"recipient_confirmed_at" timestamp with time zone,
	"tapped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"address" text NOT NULL,
	"display_name" text NOT NULL,
	"payout_position" integer,
	"payout_method" "payout_method" DEFAULT 'mpesa' NOT NULL,
	"payout_phone" text,
	"payout_lightning" text,
	"payout_nim" text,
	"consent_at" timestamp with time zone NOT NULL,
	"agreement_message" text,
	"agreement_public_key" text,
	"agreement_signature" text,
	"agreement_signed_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"recipient_address" text NOT NULL,
	"skipped_address" text,
	"opens_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "round_status" DEFAULT 'upcoming' NOT NULL,
	"msats_per_kes" integer,
	"luna_per_kes" bigint,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stake_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"kind" text NOT NULL,
	"luna" bigint NOT NULL,
	"validator" text,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"address" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chamas" ADD CONSTRAINT "chamas_creator_address_users_address_fk" FOREIGN KEY ("creator_address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_address_users_address_fk" FOREIGN KEY ("address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chamas_invite_code_idx" ON "chamas" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_round_member_idx" ON "invoices" USING btree ("round_id","member");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_payment_hash_idx" ON "invoices" USING btree ("payment_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_nimiq_hash_idx" ON "invoices" USING btree ("nimiq_hash");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "members_chama_address_idx" ON "members" USING btree ("chama_id","address");--> statement-breakpoint
CREATE INDEX "members_address_idx" ON "members" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_chama_index_idx" ON "rounds" USING btree ("chama_id","index");--> statement-breakpoint
CREATE INDEX "stake_events_address_idx" ON "stake_events" USING btree ("address");