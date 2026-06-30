import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ycSchema } from "./schema-base";
import { users } from "./auth-schema";
import { skills } from "./studio-schema";

/**
 * Spec 002 (core slice T002 + T005) — Personal Assistant data model.
 *
 * This slice owns: aiproviders (registry), paconfigs (behavioural config),
 * assistantsessions + assistantmessages (multi-turn chat). Deferred to later
 * passes (need specs 001/006/007 or more 002): PA avatar/channel (T001),
 * monitoring + panotifications (T003), calendar/email (T004), skill/subagent
 * runtime (T006), community + MCP (T007/T008).
 *
 * E2E encryption (spec 001 userencryptionkeys) is deferred — messages are stored
 * in platform mode (plaintext content) for this slice.
 */

export const aiProviderTypeEnum = ycSchema.enum("aiprovidertype", [
  "openai-compatible",
  "anthropic",
  "ollama",
  "custom",
]);

export const assistantRoleEnum = ycSchema.enum("assistantrole", [
  "user",
  "assistant",
  "tool_result",
]);

export const aiproviders = ycSchema.table(
  "aiproviders",
  {
    id: uuid("id").primaryKey(),
    // null when isdefault=true (system default); otherwise the owning user.
    userid: uuid("userid").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: aiProviderTypeEnum("type").notNull(),
    baseurl: text("baseurl").notNull().default(""),
    model: text("model").notNull(),
    // API key stored server-side; NEVER returned in API responses (a production
    // deployment would use a secrets manager — this is the apikeyref seam).
    apikey: text("apikey").notNull().default(""),
    supportstooluse: boolean("supportstooluse").notNull().default(false),
    supportsstreaming: boolean("supportsstreaming").notNull().default(true),
    isdefault: boolean("isdefault").notNull().default(false),
    lastpingedat: timestamp("lastpingedat", { withTimezone: true }),
    lastpinglatencyms: integer("lastpinglatencyms"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aiproviders_userid_idx").on(t.userid),
    // At most one system-default provider.
    uniqueIndex("aiproviders_one_default")
      .on(t.isdefault)
      .where(sql`${t.isdefault} = true`),
  ],
);

export const paconfigs = ycSchema.table(
  "paconfigs",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeproviderid: uuid("activeproviderid").references(() => aiproviders.id, {
      onDelete: "set null",
    }),
    briefingtimeutc: text("briefingtimeutc"),
    monitorintervalmin: integer("monitorintervalmin").notNull().default(5),
    notificationprefs: jsonb("notificationprefs"),
    bubbletimeoutms: integer("bubbletimeoutms").notNull().default(8000),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("paconfigs_userid_key").on(t.userid)],
);

export const assistantsessions = ycSchema.table(
  "assistantsessions",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Frozen at create — the provider this session talks to.
    providerid: uuid("providerid").references(() => aiproviders.id, {
      onDelete: "set null",
    }),
    lastmessageat: timestamp("lastmessageat", { withTimezone: true }).notNull().defaultNow(),
    deletedat: timestamp("deletedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistantsessions_userid_idx").on(t.userid)],
);

export const assistantmessages = ycSchema.table(
  "assistantmessages",
  {
    id: uuid("id").primaryKey(),
    sessionid: uuid("sessionid")
      .notNull()
      .references(() => assistantsessions.id, { onDelete: "cascade" }),
    role: assistantRoleEnum("role").notNull(),
    content: text("content").notNull().default(""), // platform mode (E2E deferred)
    toolcalls: jsonb("toolcalls"),
    prompttokens: integer("prompttokens"),
    completiontokens: integer("completiontokens"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistantmessages_sessionid_idx").on(t.sessionid)],
);

/**
 * Spec 002 T006 — skill invocation log (FR-014). Owned by spec 002 (runtime);
 * spec 004 reads it for stats. `subagentexecutionid` is a forward-compat
 * nullable column (no FK) — the subagent runtime (FR-015) is deferred.
 */
export const invokedByEnum = ycSchema.enum("invokedby", [
  "pa",
  "subagent",
  "studio_test",
]);

export const skillinvocations = ycSchema.table(
  "skillinvocations",
  {
    id: uuid("id").primaryKey(),
    skillid: uuid("skillid")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionid: uuid("sessionid").references(() => assistantsessions.id, {
      onDelete: "set null",
    }),
    subagentexecutionid: uuid("subagentexecutionid"),
    invokedby: invokedByEnum("invokedby").notNull().default("pa"),
    arguments: jsonb("arguments"),
    httpstatus: integer("httpstatus"),
    responsebody: jsonb("responsebody"),
    errormessage: text("errormessage"),
    latencyms: integer("latencyms"),
    success: boolean("success").notNull().default(false),
    invokedat: timestamp("invokedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("skillinvocations_skillid_idx").on(t.skillid)],
);

export type AiProviderRow = typeof aiproviders.$inferSelect;
export type AssistantSessionRow = typeof assistantsessions.$inferSelect;
