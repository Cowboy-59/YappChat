-- Spec 071 FR-028 — persist in-session presentation chat (for replay transcript + summary).
-- Hand-authored (scoped, additive).

CREATE TABLE IF NOT EXISTS "yappchat"."presentationchatmessages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"presentationid" uuid NOT NULL,
	"userid" uuid,
	"name" text NOT NULL,
	"text" text NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "yappchat"."presentationchatmessages"
    ADD CONSTRAINT "presentationchatmessages_presentationid_fk"
    FOREIGN KEY ("presentationid") REFERENCES "yappchat"."presentations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presentationchatmessages_presentationid_idx" ON "yappchat"."presentationchatmessages" USING btree ("presentationid");
