-- Spec 017 FR-012 (per-viewer smart auto-translation) + spec 068 (global setting)
-- + spec 018 FR-018-TR-* (escrow-DM parity). Foundation slice: the translate
-- setting, the per-room override, and the translation cache.
-- Hand-authored (scoped, idempotent); db-migrate.mjs applies by file.

-- Global "always show messages in my language" default (target = preferredlanguage).
ALTER TABLE "yappchat"."users" ADD COLUMN IF NOT EXISTS "autotranslate" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Per-room override: NULL = inherit the account default; true/false = force per room.
ALTER TABLE "yappchat"."conversationmembers" ADD COLUMN IF NOT EXISTS "autotranslate" boolean;
--> statement-breakpoint

-- Per-viewer translation cache: one row per (message, target language), reused by
-- every viewer of that language. translatedcontent = plaintext tier (017 spaces);
-- encryptedpayload = escrow-DM tier (018 §7, KMS-wrapped conversation DEK). Exactly
-- one is populated per row.
CREATE TABLE IF NOT EXISTS "yappchat"."messagetranslations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"messageid" uuid NOT NULL,
	"langcode" text NOT NULL,
	"sourcelang" text NOT NULL,
	"translatedcontent" text,
	"encryptedpayload" bytea,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "yappchat"."messagetranslations" ADD CONSTRAINT "messagetranslations_messageid_messages_id_fk" FOREIGN KEY ("messageid") REFERENCES "yappchat"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messagetranslations_message_lang_key" ON "yappchat"."messagetranslations" USING btree ("messageid","langcode");
