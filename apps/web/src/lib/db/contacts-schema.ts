import { sql } from "drizzle-orm";
import { index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { users } from "./auth-schema";

/**
 * Contacts — the "Individuals" context. A many-to-many connection between users
 * with a request/accept flow. The request is surfaced as a private message in the
 * 1:1 conversation (`conversationid`); accepting unlocks normal DM chatting.
 *
 * Spec 018 delta §2 (2026-07-01): each request is an IMMUTABLE event row. A row
 * moves `pending → (accepted|declined)` exactly once and is then terminal — a
 * `declined` row is never resurrected to `pending`; a re-request creates a NEW
 * row. "Connected" is derived from an `accepted` row existing (either direction),
 * not from a single mutable pair cell. `usera`/`userb` are the canonical
 * (LEAST/GREATEST) unordered-pair key backing a partial unique index that
 * enforces at-most-one-active (`pending`/`accepted`) row per pair; `declined`
 * rows are excluded and kept as 24h purgeable history.
 */
export const contactStatusEnum = ycSchema.enum("contactstatus", ["pending", "accepted", "declined"]);

export const contacts = ycSchema.table(
  "contacts",
  {
    id: uuid("id").primaryKey(),
    requesterid: uuid("requesterid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeid: uuid("addresseeid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: contactStatusEnum("status").notNull().default("pending"),
    // The 1:1 conversation carrying the connect request + the DM thread.
    conversationid: uuid("conversationid"),
    // Canonical unordered-pair key (usera = LEAST, userb = GREATEST), computed at
    // insert. Direction is still preserved via requesterid/addresseeid.
    usera: uuid("usera").notNull(),
    userb: uuid("userb").notNull(),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    respondedat: timestamp("respondedat", { withTimezone: true }),
  },
  (t) => [
    // At most one ACTIVE (pending/accepted) row per unordered pair. Declined rows
    // are excluded by the predicate and may accumulate as history.
    uniqueIndex("contacts_active_pair_key")
      .on(t.usera, t.userb)
      .where(sql`${t.status} in ('pending','accepted')`),
    index("contacts_addressee_idx").on(t.addresseeid),
    index("contacts_requester_idx").on(t.requesterid),
    index("contacts_pair_idx").on(t.usera, t.userb),
  ],
);

/** Email invites to connect when the searched person has no account yet. */
export const contactinvites = ycSchema.table(
  "contactinvites",
  {
    id: uuid("id").primaryKey(),
    inviterid: uuid("inviterid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenhash: text("tokenhash").notNull(),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    consumedat: timestamp("consumedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contactinvites_tokenhash_key").on(t.tokenhash),
    index("contactinvites_inviter_idx").on(t.inviterid),
  ],
);

/**
 * Contact-request flood freezes (spec 018 delta §5). A durable, human-gated stop
 * that blocks ONLY the sending of new contact requests when a user trips the
 * rolling-rate flood guard. An active (uncleared) row means "frozen from sending
 * contact requests"; at most one active row per user (partial unique index). The
 * freeze never auto-expires — only a sysadmin unfreeze sets `clearedat`.
 */
export const contactfreezes = ycSchema.table(
  "contactfreezes",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // 'contact_flood' for this section
    triggercount: integer("triggercount").notNull(),
    triggerlimit: integer("triggerlimit").notNull(),
    windowms: integer("windowms").notNull(),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    clearedat: timestamp("clearedat", { withTimezone: true }),
    clearedby: uuid("clearedby").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    // At most one ACTIVE freeze per user.
    uniqueIndex("contactfreezes_active_user_key")
      .on(t.userid)
      .where(sql`${t.clearedat} is null`),
    index("contactfreezes_active_idx").on(t.clearedat),
  ],
);

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInviteRow = typeof contactinvites.$inferSelect;
export type ContactFreezeRow = typeof contactfreezes.$inferSelect;
