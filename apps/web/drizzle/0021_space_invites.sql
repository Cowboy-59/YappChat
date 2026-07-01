-- Spec 017 FR-020 (2026-07-01) — per-space invite links. A `communityinvites` row
-- may now target one space: spaceid NULL = community-wide invite (FR-004, existing
-- behavior), spaceid set = admit the redeemer directly into that space's
-- conversation, overriding the space's own strict (invite/adminonly/corponly) policy.
-- Hand-authored (drizzle-kit snapshot has drifted; db-migrate.mjs applies by file).
ALTER TABLE "yappchat"."communityinvites" ADD COLUMN "spaceid" uuid;--> statement-breakpoint
ALTER TABLE "yappchat"."communityinvites" ADD CONSTRAINT "communityinvites_spaceid_spaces_id_fk" FOREIGN KEY ("spaceid") REFERENCES "yappchat"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communityinvites_spaceid_idx" ON "yappchat"."communityinvites" USING btree ("spaceid");
