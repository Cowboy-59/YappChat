import { index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";

/**
 * Spec 090 — Chat Groupings Foundation.
 *
 * Per-user "folders" for organizing a user's chat rooms in the sidebar. A
 * grouping is owned by and visible to only its `userid`; it is strictly a
 * view-layer construct and NEVER affects room membership or access. A room is
 * filed under a grouping via `conversationmembers.groupingid` (engine-schema) —
 * per-user, at most one grouping per room.
 *
 * `type` is `general | projects`. In spec 090 it is stored and displayed but has
 * NO behavioral effect; SPEC-091 (Project Systems) is the sole consumer that keys
 * AI remote-management binding off `type = 'projects'`.
 *
 * `userid` is the owner's `users.id`; left FK-less in Drizzle to mirror the engine
 * schema's decoupling (see `conversationmembers.userid`). The real FK for
 * `conversationmembers.groupingid → chatgroupings.id` (ON DELETE SET NULL) lives in
 * the migration, not the Drizzle relation.
 */
export const chatgroupings = ycSchema.table(
  "chatgroupings",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull().default("general"), // general | projects
    position: integer("position").notNull().default(0),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chatgroupings_user_name_key").on(t.userid, t.name),
    index("chatgroupings_userid_idx").on(t.userid),
  ],
);

export const GROUPING_TYPES = ["general", "projects"] as const;
export type GroupingType = (typeof GROUPING_TYPES)[number];

export type ChatGroupingRow = typeof chatgroupings.$inferSelect;
