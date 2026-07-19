-- Spec 090 — Chat Groupings Foundation.
-- Hand-authored focused migration (the repo applies migrations manually; the
-- drizzle journal is desynced past 0019, so `generate` over-diffs). Apply after 0027.
-- Idempotent guards so a manual re-run is safe. Statement-breakpoint markers let
-- scripts/db-migrate.mjs apply each statement individually.

-- Per-user chat groupings ("folders"). Owned by userid; view-layer only.
CREATE TABLE IF NOT EXISTS "yappchat"."chatgroupings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chatgroupings_user_name_key" ON "yappchat"."chatgroupings" USING btree ("userid","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatgroupings_userid_idx" ON "yappchat"."chatgroupings" USING btree ("userid");
--> statement-breakpoint
-- Per-user placement of a room under one of that user's groupings. NULL = ungrouped.
ALTER TABLE "yappchat"."conversationmembers" ADD COLUMN IF NOT EXISTS "groupingid" uuid;
--> statement-breakpoint
ALTER TABLE "yappchat"."conversationmembers" ADD COLUMN IF NOT EXISTS "position" integer;
--> statement-breakpoint
-- Deleting a grouping returns its rooms to ungrouped (ON DELETE SET NULL) — never
-- touches the membership row's identity, so no room or message is ever lost.
DO $$ BEGIN
  ALTER TABLE "yappchat"."conversationmembers" ADD CONSTRAINT "conversationmembers_groupingid_chatgroupings_id_fk" FOREIGN KEY ("groupingid") REFERENCES "yappchat"."chatgroupings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversationmembers_groupingid_idx" ON "yappchat"."conversationmembers" USING btree ("groupingid");
