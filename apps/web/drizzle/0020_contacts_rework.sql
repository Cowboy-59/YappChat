-- Spec 018 delta §2/§5 (2026-07-01) — contacts graph rework + contact-request flood freezes.
-- Reworks `contacts` from a single mutable ordered-pair cell into immutable request
-- events with a derived "connected = an accepted row exists" model, enforced by a
-- partial unique index on a canonical unordered-pair key. Adds `contactfreezes`.
--
-- IMPORTANT: the pre-existing unique index is on the ORDERED pair
-- (requesterid, addresseeid), so a single unordered pair CAN legitimately hold two
-- active rows today (e.g. A->B accepted + B->A pending). The reconciliation step
-- below MUST run BEFORE creating the new partial unique index, or the index build
-- fails on legitimate existing data. Rule: per unordered pair, keep one active row
-- (prefer accepted, then earliest) and decline the rest.

-- 1. Add the canonical unordered-pair columns (nullable first for backfill).
ALTER TABLE "yappchat"."contacts" ADD COLUMN "usera" uuid;--> statement-breakpoint
ALTER TABLE "yappchat"."contacts" ADD COLUMN "userb" uuid;--> statement-breakpoint

-- 2. Backfill: usera = LEAST(requester, addressee), userb = GREATEST(...).
UPDATE "yappchat"."contacts"
SET "usera" = LEAST("requesterid", "addresseeid"),
    "userb" = GREATEST("requesterid", "addresseeid");--> statement-breakpoint

-- 3. Reconcile multi-active pairs BEFORE adding the partial unique index. Keep one
--    active row per unordered pair (accepted wins, then earliest createdat/id);
--    decline the rest so the new at-most-one-active invariant holds on legacy data.
WITH ranked AS (
  SELECT "id",
    row_number() OVER (
      PARTITION BY "usera", "userb"
      ORDER BY ("status" = 'accepted') DESC, "createdat" ASC, "id" ASC
    ) AS rn
  FROM "yappchat"."contacts"
  WHERE "status" IN ('pending', 'accepted')
)
UPDATE "yappchat"."contacts" c
SET "status" = 'declined',
    "respondedat" = COALESCE(c."respondedat", now())
FROM ranked r
WHERE c."id" = r."id" AND r.rn > 1;--> statement-breakpoint

-- 4. Now the columns are fully populated and reconciled — enforce NOT NULL.
ALTER TABLE "yappchat"."contacts" ALTER COLUMN "usera" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "yappchat"."contacts" ALTER COLUMN "userb" SET NOT NULL;--> statement-breakpoint

-- 5. Drop the ordered-pair unique index; multiple rows per pair over time are now expected.
DROP INDEX IF EXISTS "yappchat"."contacts_pair_key";--> statement-breakpoint

-- 6. At-most-one-active row per unordered pair (declined rows excluded → 24h history).
CREATE UNIQUE INDEX "contacts_active_pair_key" ON "yappchat"."contacts" USING btree ("usera","userb") WHERE "status" in ('pending','accepted');--> statement-breakpoint
CREATE INDEX "contacts_pair_idx" ON "yappchat"."contacts" USING btree ("usera","userb");--> statement-breakpoint

-- 7. Contact-request flood freezes (durable, sysadmin-cleared).
CREATE TABLE "yappchat"."contactfreezes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"reason" text NOT NULL,
	"triggercount" integer NOT NULL,
	"triggerlimit" integer NOT NULL,
	"windowms" integer NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"clearedat" timestamp with time zone,
	"clearedby" uuid
);
--> statement-breakpoint
ALTER TABLE "yappchat"."contactfreezes" ADD CONSTRAINT "contactfreezes_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."contactfreezes" ADD CONSTRAINT "contactfreezes_clearedby_users_id_fk" FOREIGN KEY ("clearedby") REFERENCES "yappchat"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contactfreezes_active_user_key" ON "yappchat"."contactfreezes" USING btree ("userid") WHERE "clearedat" is null;--> statement-breakpoint
CREATE INDEX "contactfreezes_active_idx" ON "yappchat"."contactfreezes" USING btree ("clearedat");
