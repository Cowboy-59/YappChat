import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { conversations } from "./engine-schema";
import { users } from "./auth-schema";

/**
 * Spec 088 (Remote Screen Control in DMs) — data model.
 *
 * A **control session** is a consented, time-bounded grant of mouse/keyboard
 * control from a host to a controller inside a single 1:1 DM (spec 018). The
 * screen video itself rides the existing LiveKit path (specs 071/087); this
 * schema owns only the control lifecycle + the single-use agent token + audit.
 *
 * Security posture (FR-003/006/012/013/014): no standing access — a row is
 * short-lived, its token is single-use (only its hash is stored), and every
 * lifecycle transition is written to the append-only audit table.
 */

// Session lifecycle. `requested` → host prompted; `agent_pending` → host allowed,
// token minted, waiting for the helper agent to register; `granted` → control
// live; `paused` → host's own input reclaimed control temporarily; `ended` →
// terminal (stopped / panic / disconnect / decline), token dead.
export const remoteControlStatusEnum = ycSchema.enum("remotecontrolstatus", [
  "requested",
  "agent_pending",
  "granted",
  "paused",
  "ended",
]);

// Append-only audit event kinds across a session's life (FR-014).
export const remoteControlAuditEventEnum = ycSchema.enum("remotecontrolauditevent", [
  "requested",
  "allowed",
  "declined",
  "agent_registered",
  "granted",
  "paused",
  "resumed",
  "stopped",
  "panic",
  "disconnected",
]);

export const remotecontrolsessions = ycSchema.table(
  "remotecontrolsessions",
  {
    id: uuid("id").primaryKey(),
    // The 1:1 DM conversation this control session belongs to (trust boundary).
    dmconversationid: uuid("dmconversationid")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Who drives (controller) and whose machine is driven (host).
    controlleruserid: uuid("controlleruserid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hostuserid: uuid("hostuserid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: remoteControlStatusEnum("status").notNull().default("requested"),
    // SHA-256 of the single-use agent token; NULL until the host allows control.
    tokenhash: text("tokenhash"),
    // Short TTL for the agent to register after allow; null once consumed/ended.
    tokenexpiresat: timestamp("tokenexpiresat", { withTimezone: true }),
    // When control was first granted, and when the session ended + why.
    startedat: timestamp("startedat", { withTimezone: true }),
    endedat: timestamp("endedat", { withTimezone: true }),
    endreason: text("endreason"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("remotecontrolsessions_dm_idx").on(t.dmconversationid),
    index("remotecontrolsessions_tokenhash_idx").on(t.tokenhash),
    index("remotecontrolsessions_host_status_idx").on(t.hostuserid, t.status),
  ],
);

export const remotecontrolaudit = ycSchema.table(
  "remotecontrolaudit",
  {
    id: uuid("id").primaryKey(),
    sessionid: uuid("sessionid")
      .notNull()
      .references(() => remotecontrolsessions.id, { onDelete: "cascade" }),
    event: remoteControlAuditEventEnum("event").notNull(),
    // Who caused the event; nullable (system/disconnect events have no actor).
    actoruserid: uuid("actoruserid").references(() => users.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload"),
  },
  (t) => [index("remotecontrolaudit_sessionid_idx").on(t.sessionid)],
);

export type RemoteControlSessionRow = typeof remotecontrolsessions.$inferSelect;
export type RemoteControlAuditRow = typeof remotecontrolaudit.$inferSelect;
export type RemoteControlStatus = RemoteControlSessionRow["status"];
