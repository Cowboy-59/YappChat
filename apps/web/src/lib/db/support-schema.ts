import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { conversations } from "./engine-schema";
import { orgs } from "./auth-schema";

/**
 * App Support Chatroom — the support-specific metadata for a help session.
 *
 * The chat itself is a spec 001 `conversation` (kind `support`) with the requester
 * + the org's support agents in `conversationmembers`; messages + live delivery
 * ride the existing engine unchanged. This table adds only what support needs:
 * which app the request came from, which org owns it, status, and the assigned
 * agent. Routing is per-app (`appkey`) but org-scoped (`orgid`).
 *
 * `requesterid` is TEXT (not an FK): a logged-in requester is a `users.id` today;
 * Phase 2 (embeddable/cross-domain) uses a guest id that has no users row.
 */
export const supportStatusEnum = ycSchema.enum("supportstatus", ["open", "assigned", "closed"]);

export const supportsessions = ycSchema.table(
  "supportsessions",
  {
    id: uuid("id").primaryKey(),
    conversationid: uuid("conversationid")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    orgid: uuid("orgid")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    appkey: text("appkey").notNull(), // e.g. "wxkanban", "yappchat"
    status: supportStatusEnum("status").notNull().default("open"),
    requesterid: text("requesterid").notNull(),
    assignedagentid: uuid("assignedagentid"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    closedat: timestamp("closedat", { withTimezone: true }),
  },
  (t) => [
    index("supportsessions_orgid_status_idx").on(t.orgid, t.status),
    index("supportsessions_conversationid_idx").on(t.conversationid),
  ],
);

export type SupportSessionRow = typeof supportsessions.$inferSelect;
