-- [SCOPE 093 / T006] BEGIN — conversations.retiredat (retired project rooms)
-- SPEC-093 FR-006 — wxKanban company chat API: a retired room is hidden from its
-- members' lists (the owner keeps it, with full history) and takes no new messages.
-- Hand-authored focused migration (manual apply; the drizzle journal is desynced
-- past 0019, see 0029/0030). Additive and nullable: every existing row stays active.
-- Apply after 0030 and BEFORE deploying the web build that declares the column —
-- the engine selects every declared column of conversations, so a declared-but-missing
-- column would fail every conversation read.
-- Idempotent guard so a manual re-run is safe.

ALTER TABLE "yappchat"."conversations" ADD COLUMN IF NOT EXISTS "retiredat" timestamp with time zone;
-- [SCOPE 093 / T006] END
