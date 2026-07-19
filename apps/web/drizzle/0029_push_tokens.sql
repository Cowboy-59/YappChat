-- Spec 009 — push notification tokens.
-- Hand-authored focused migration (manual apply; drizzle journal desynced past 0019).
-- Apply after 0028. Idempotent guards so a manual re-run is safe.

CREATE TABLE IF NOT EXISTS "yappchat"."pushtokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"deviceid" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pushtokens_token_key" ON "yappchat"."pushtokens" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pushtokens_userid_idx" ON "yappchat"."pushtokens" USING btree ("userid");
