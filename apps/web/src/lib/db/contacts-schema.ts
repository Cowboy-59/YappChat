import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { users } from "./auth-schema";

/**
 * Contacts — the "Individuals" context. A many-to-many connection between users
 * with a request/accept flow. The request is surfaced as a private message in the
 * 1:1 conversation (`conversationid`); accepting unlocks normal DM chatting.
 * A contact is mutual once `accepted` (direction is kept only for "who asked").
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
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    respondedat: timestamp("respondedat", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("contacts_pair_key").on(t.requesterid, t.addresseeid),
    index("contacts_addressee_idx").on(t.addresseeid),
    index("contacts_requester_idx").on(t.requesterid),
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

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInviteRow = typeof contactinvites.$inferSelect;
