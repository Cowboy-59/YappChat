-- Spec 001 FR-015 — user-initiated message deletion (soft-delete "unsend for everyone").
-- Hand-authored (scoped): adds the tombstone columns + the immutable audit table only.

CREATE TABLE IF NOT EXISTS "yappchat"."messageauditlog" (
	"id" uuid PRIMARY KEY NOT NULL,
	"messageid" uuid NOT NULL,
	"conversationid" uuid,
	"actorid" uuid,
	"action" text NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messageauditlog_messageid_idx" ON "yappchat"."messageauditlog" USING btree ("messageid");
--> statement-breakpoint
ALTER TABLE "yappchat"."messages" ADD COLUMN IF NOT EXISTS "deletedat" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "yappchat"."messages" ADD COLUMN IF NOT EXISTS "deletedby" uuid;
