-- Spec 071 FR-023 — recording hardening: capture the LiveKit egress lifecycle.
-- Hand-authored (scoped, additive, nullable).

ALTER TABLE "yappchat"."presentations" ADD COLUMN IF NOT EXISTS "egressid" text;
--> statement-breakpoint
ALTER TABLE "yappchat"."presentations" ADD COLUMN IF NOT EXISTS "egressstatus" text;
--> statement-breakpoint
ALTER TABLE "yappchat"."presentations" ADD COLUMN IF NOT EXISTS "egresserror" text;
--> statement-breakpoint
ALTER TABLE "yappchat"."presentationrecordings" ADD COLUMN IF NOT EXISTS "egressid" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "presentationrecordings_egressid_key" ON "yappchat"."presentationrecordings" USING btree ("egressid") WHERE "egressid" IS NOT NULL;
