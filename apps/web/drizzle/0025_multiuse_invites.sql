-- Spec 017 FR-021 (2026-07-11) — reusable (multi-use) invite links. A
-- `communityinvites` row can now be redeemed more than once: `maxuses` bounds the
-- number of redemptions (NULL = unlimited; 1 = single-use, the FR-020 default) and
-- `usecount` tracks progress. `usedat` is repurposed as a "dead" marker — set when
-- the cap is reached OR on revoke. `communityinviteredemptions` logs who redeemed a
-- shared link and (via the unique index) backs the "already redeemed → no-op" check.
-- Hand-authored (drizzle-kit snapshot has drifted; db-migrate.mjs applies by file).
ALTER TABLE "yappchat"."communityinvites" ADD COLUMN "maxuses" integer;--> statement-breakpoint
ALTER TABLE "yappchat"."communityinvites" ADD COLUMN "usecount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: every existing invite was single-use; a spent one has usedat set.
UPDATE "yappchat"."communityinvites" SET "maxuses" = 1 WHERE "maxuses" IS NULL;--> statement-breakpoint
UPDATE "yappchat"."communityinvites" SET "usecount" = 1 WHERE "usedat" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "yappchat"."communityinviteredemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"inviteid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"redeemedat" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "yappchat"."communityinviteredemptions" ADD CONSTRAINT "communityinviteredemptions_inviteid_communityinvites_id_fk" FOREIGN KEY ("inviteid") REFERENCES "yappchat"."communityinvites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communityinviteredemptions_invite_user_key" ON "yappchat"."communityinviteredemptions" USING btree ("inviteid","userid");--> statement-breakpoint
CREATE INDEX "communityinviteredemptions_inviteid_idx" ON "yappchat"."communityinviteredemptions" USING btree ("inviteid");
