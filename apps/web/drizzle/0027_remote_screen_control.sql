-- Spec 088 — Remote Screen Control in DMs (FR-009, FR-014).
-- Hand-authored focused migration (the repo applies migrations manually; the
-- drizzle journal is desynced past 0019, so generate over-diffs). Apply after 0026.
-- Idempotent guards so a manual re-run is safe. Statement-breakpoint markers let
-- scripts/db-migrate.mjs apply each statement individually.

DO $$ BEGIN
  CREATE TYPE "yappchat"."remotecontrolstatus" AS ENUM('requested', 'agent_pending', 'granted', 'paused', 'ended');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "yappchat"."remotecontrolauditevent" AS ENUM('requested', 'allowed', 'declined', 'agent_registered', 'granted', 'paused', 'resumed', 'stopped', 'panic', 'disconnected');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "yappchat"."remotecontrolsessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dmconversationid" uuid NOT NULL,
	"controlleruserid" uuid NOT NULL,
	"hostuserid" uuid NOT NULL,
	"status" "yappchat"."remotecontrolstatus" DEFAULT 'requested' NOT NULL,
	"tokenhash" text,
	"tokenexpiresat" timestamp with time zone,
	"startedat" timestamp with time zone,
	"endedat" timestamp with time zone,
	"endreason" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "yappchat"."remotecontrolaudit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sessionid" uuid NOT NULL,
	"event" "yappchat"."remotecontrolauditevent" NOT NULL,
	"actoruserid" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "yappchat"."remotecontrolsessions" ADD CONSTRAINT "remotecontrolsessions_dmconversationid_conversations_id_fk" FOREIGN KEY ("dmconversationid") REFERENCES "yappchat"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "yappchat"."remotecontrolsessions" ADD CONSTRAINT "remotecontrolsessions_controlleruserid_users_id_fk" FOREIGN KEY ("controlleruserid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "yappchat"."remotecontrolsessions" ADD CONSTRAINT "remotecontrolsessions_hostuserid_users_id_fk" FOREIGN KEY ("hostuserid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "yappchat"."remotecontrolaudit" ADD CONSTRAINT "remotecontrolaudit_sessionid_remotecontrolsessions_id_fk" FOREIGN KEY ("sessionid") REFERENCES "yappchat"."remotecontrolsessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "yappchat"."remotecontrolaudit" ADD CONSTRAINT "remotecontrolaudit_actoruserid_users_id_fk" FOREIGN KEY ("actoruserid") REFERENCES "yappchat"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remotecontrolsessions_dm_idx" ON "yappchat"."remotecontrolsessions" USING btree ("dmconversationid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remotecontrolsessions_tokenhash_idx" ON "yappchat"."remotecontrolsessions" USING btree ("tokenhash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remotecontrolsessions_host_status_idx" ON "yappchat"."remotecontrolsessions" USING btree ("hostuserid","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remotecontrolaudit_sessionid_idx" ON "yappchat"."remotecontrolaudit" USING btree ("sessionid");
