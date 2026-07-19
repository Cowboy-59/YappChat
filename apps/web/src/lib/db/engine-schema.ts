import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";

/**
 * Spec 001 (core slice T1 + T2) — Common Chat Engine data model.
 *
 * This slice creates the canonical messaging tables: channels, channelaccounts,
 * conversations, messages, messagedeliveries. Deferred to their tasks (and not
 * created here): org directory (T4 — note `orgs` already exists from spec 011;
 * reconcile there), agents (T5), userencryptionkeys/retention/audit (T6),
 * videorooms (T7), status tables (T8). `messages.orgmemberid` /
 * `encryptionkeyid` are nullable columns with no FK until those tasks land.
 */

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const channelStatusEnum = ycSchema.enum("channelstatus", [
  "healthy",
  "degraded",
  "offline",
]);
export const msgEncryptionEnum = ycSchema.enum("msgencryptiontype", [
  "e2e",
  "agent-e2e",
  "platform",
]);
export const msgTypeEnum = ycSchema.enum("msgtype", ["chat", "status"]);
export const msgDirectionEnum = ycSchema.enum("msgdirection", ["inbound", "outbound"]);
export const ackStateEnum = ycSchema.enum("ackstate", ["pending", "acked", "nacked"]);
export const conversationKindEnum = ycSchema.enum("conversationkind", [
  "channel",
  "group",
  "person",
  "agent",
  // Spec 001 T009 — canonical "room" kind for communities/spaces (spec 017).
  // Added (not renamed) so existing `channel`-kind rows are untouched; `channel`
  // kind is deprecated for new work.
  "space",
  // App Support Chatroom — a queue-routed customer↔org-support conversation.
  // Backed by the `supportsessions` table (support-schema.ts).
  "support",
]);

export const channels = ycSchema.table(
  "channels",
  {
    id: uuid("id").primaryKey(),
    platformid: text("platformid").notNull(), // e.g. slack, discord, yappchat-internal
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config"),
    status: channelStatusEnum("status").notNull().default("offline"),
    lastseenat: timestamp("lastseenat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("channels_platformid_idx").on(t.platformid)],
);

export const channelaccounts = ycSchema.table("channelaccounts", {
  id: uuid("id").primaryKey(),
  channelid: uuid("channelid")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  accountid: text("accountid").notNull(),
  tokensource: text("tokensource").notNull().default("none"), // env | config | none
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config"),
  createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = ycSchema.table(
  "conversations",
  {
    id: uuid("id").primaryKey(),
    channelid: uuid("channelid")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    kind: conversationKindEnum("kind").notNull().default("channel"),
    externalid: text("externalid"), // platform thread/room id
    lastmessageat: timestamp("lastmessageat", { withTimezone: true }).notNull().defaultNow(),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_channelid_idx").on(t.channelid)],
);

export const messages = ycSchema.table(
  "messages",
  {
    id: uuid("id").primaryKey(),
    channelid: uuid("channelid")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    conversationid: uuid("conversationid").references(() => conversations.id, {
      onDelete: "set null",
    }),
    platformmessageid: text("platformmessageid"), // dedup key (unique with channelid)
    authorid: text("authorid").notNull(),
    orgmemberid: uuid("orgmemberid"), // FK -> orgmembers (T4), deferred
    encryptiontype: msgEncryptionEnum("encryptiontype").notNull().default("platform"),
    content: text("content"), // NULL for e2e/agent-e2e
    encryptedpayload: bytea("encryptedpayload"),
    encryptionkeyid: uuid("encryptionkeyid"), // FK -> userencryptionkeys (T6), deferred
    mediaurl: text("mediaurl").array(),
    messagetype: msgTypeEnum("messagetype").notNull().default("chat"),
    direction: msgDirectionEnum("direction").notNull(),
    ackstate: ackStateEnum("ackstate").notNull().default("pending"),
    ackedat: timestamp("ackedat", { withTimezone: true }),
    purgeat: timestamp("purgeat", { withTimezone: true }),
    // FR-015 — user-initiated soft-delete ("unsend for everyone"). NULL = live;
    // when set, content/encryptedpayload/mediaurl are cleared and the row renders
    // as a "This message was deleted" tombstone. `deletedby` is the actor userid.
    deletedat: timestamp("deletedat", { withTimezone: true }),
    deletedby: uuid("deletedby"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("messages_channel_platformmsg_key").on(t.channelid, t.platformmessageid),
    index("messages_conversationid_idx").on(t.conversationid),
  ],
);

export const messagedeliveries = ycSchema.table(
  "messagedeliveries",
  {
    id: uuid("id").primaryKey(),
    messageid: uuid("messageid")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    channelid: uuid("channelid")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    ackstate: ackStateEnum("ackstate").notNull().default("pending"),
    retrycount: integer("retrycount").notNull().default(0),
    error: text("error"),
    primaryplatformmessageid: text("primaryplatformmessageid"),
    sentat: timestamp("sentat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messagedeliveries_messageid_idx").on(t.messageid)],
);

/**
 * Spec 001 FR-012/FR-015 — immutable audit trail for message lifecycle events
 * (deletion, retention purge). Written on every user-initiated delete (FR-015)
 * and by the retention purge job (FR-012). Retained 90 days, NOT subject to a
 * user's retention policy. `actorid` is the userid who took the action (NULL for
 * automated purge). Deliberately append-only: no update/delete in app code.
 */
export const messageauditlog = ycSchema.table(
  "messageauditlog",
  {
    id: uuid("id").primaryKey(),
    messageid: uuid("messageid").notNull(),
    conversationid: uuid("conversationid"),
    actorid: uuid("actorid"),
    action: text("action").notNull(), // 'user-delete' | 'purge'
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messageauditlog_messageid_idx").on(t.messageid)],
);

/**
 * Spec 001 T009 — shared membership core. The single source for who's in a
 * conversation; powers the member list, native fan-out, and `conversation:{id}`
 * subscribe authorization. Reused by every communication context (Company /
 * Groups / Individuals — see specs/design/communication-model.md). Deliberately
 * generic: no community-specific columns (those live in spec 017's tables).
 * `userid` is the member's `users.id`; left FK-less to keep the engine schema
 * decoupled from auth-schema (mirrors `messages.orgmemberid`).
 */
export const conversationmembers = ycSchema.table(
  "conversationmembers",
  {
    id: uuid("id").primaryKey(),
    conversationid: uuid("conversationid")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userid: uuid("userid").notNull(),
    role: text("role").notNull().default("member"),
    lastreadat: timestamp("lastreadat", { withTimezone: true }),
    // Spec 017 FR-012 / 018 FR-018-TR-* — per-room translate override for this
    // member. NULL = inherit the global account default (users.autotranslate);
    // true/false = force this room on/off regardless of the account default.
    autotranslate: boolean("autotranslate"),
    // Spec 090 — per-user chat grouping ("folder") this member filed this room
    // under. NULL = ungrouped (renders in the flat list as today). `position`
    // orders rooms within the grouping. Kept FK-less in Drizzle (like `userid`);
    // the real FK → chatgroupings.id ON DELETE SET NULL lives in migration 0028.
    groupingid: uuid("groupingid"),
    position: integer("position"),
    joinedat: timestamp("joinedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversationmembers_conv_user_key").on(t.conversationid, t.userid),
    index("conversationmembers_userid_idx").on(t.userid),
  ],
);

/**
 * Spec 017 FR-012 + spec 018 FR-018-TR-003 — per-viewer message translation cache.
 *
 * A message is translated into a given target language at most once, then reused
 * by every viewer sharing that language (never per-person, never all-languages
 * up front). Same-language views never create a row. Keyed unique on
 * (messageid, langcode).
 *
 * Two payload columns mirror how `messages` stores content:
 *  - `translatedcontent` (plaintext) for space/plaintext-tier messages (017);
 *  - `encryptedpayload` (bytea, KMS-wrapped conversation DEK) for escrow-DM
 *    translations (018 §7) — a private translation is as sensitive as its
 *    original, so it MUST NOT be written as plaintext.
 * Exactly one is populated per row, per the source message's tier.
 */
export const messagetranslations = ycSchema.table(
  "messagetranslations",
  {
    id: uuid("id").primaryKey(),
    messageid: uuid("messageid")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    langcode: text("langcode").notNull(), // target ISO 639-1 (en/fr/es/de/it/pt)
    sourcelang: text("sourcelang").notNull(), // the original's language at translate time
    translatedcontent: text("translatedcontent"), // plaintext tier (017)
    encryptedpayload: bytea("encryptedpayload"), // escrow-DM tier (018 §7)
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("messagetranslations_message_lang_key").on(t.messageid, t.langcode),
  ],
);

export type ChannelRow = typeof channels.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type MessageAuditLogRow = typeof messageauditlog.$inferSelect;
export type ConversationMemberRow = typeof conversationmembers.$inferSelect;
export type MessageTranslationRow = typeof messagetranslations.$inferSelect;
