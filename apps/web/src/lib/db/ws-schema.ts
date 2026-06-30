import { bigint, index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { users } from "./auth-schema";

/**
 * Spec 003 (T001 + T005) — WebSocket engine persistence.
 *
 * Two tables, both in the `yappchat` schema, UUID v7 PKs generated app-side via
 * `uuidv7()` (per project DB conventions — see engine-schema.ts):
 *
 *  - `wssessions`: one row per live WebSocket connection. The PK doubles as the
 *    `sessionid` sent to the client in the `connected` message. Rows are inserted
 *    on connect and deleted on close / dead-connection cleanup (T004). The
 *    `subscriptions` array is a cached projection of the in-memory sub set.
 *
 *  - `wsevents`: the replay log. Every published event is inserted with a fixed
 *    5-minute TTL; `id` (monotonic v7) is the replay cursor. A 60s cleanup job
 *    deletes expired rows. This is TRANSIENT recovery only — durable message
 *    persistence is spec 001's job.
 */

export const wssessions = ycSchema.table("wssessions", {
  id: uuid("id").primaryKey(), // = sessionid sent to the client
  userid: uuid("userid")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subscriptions: text("subscriptions").array().notNull().default([]),
  connectedat: timestamp("connectedat", { withTimezone: true }).notNull().defaultNow(),
  lastheartbeat: timestamp("lastheartbeat", { withTimezone: true }).notNull().defaultNow(),
});

export const wsevents = ycSchema.table(
  "wsevents",
  {
    id: uuid("id").primaryKey(), // UUID v7 — monotonic replay cursor
    type: text("type").notNull(),
    scope: text("scope").notNull(),
    payload: jsonb("payload"),
    ts: bigint("ts", { mode: "number" }).notNull(), // Unix ms
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("wsevents_scope_id_idx").on(t.scope, t.id), // replay: WHERE scope IN (...) AND id > cursor
    index("wsevents_expiresat_idx").on(t.expiresat), // cleanup job
  ],
);
