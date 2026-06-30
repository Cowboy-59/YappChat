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
import { ycSchema } from "./schema-base";
import { orgs, users } from "./auth-schema";

/**
 * Spec 004 (core slice T001–T004) — Agent & Skill Creation Studio data model.
 *
 * This spec OWNS `skills`, `skillversions`, `skilltestlogs`, `agenttemplates`,
 * `agenttemplateskills`. Runtime/metrics tables (skillinvocations,
 * subagentexecutions) belong to spec 002 and are read-only from here — deferred
 * until 002 exists. `agenttemplates.providerid` references spec 002 `aiproviders`;
 * kept as a plain nullable uuid (no FK) until 002 ships.
 */

export const skillCategoryEnum = ycSchema.enum("skillcategory", [
  "productivity",
  "communication",
  "data",
  "development",
  "finance",
  "media",
  "integration",
  "custom",
]);

export const skillCreatedByEnum = ycSchema.enum("skillcreatedby", [
  "studio",
  "pa",
  "import",
]);

export const skills = ycSchema.table(
  "skills",
  {
    id: uuid("id").primaryKey(),
    orgid: uuid("orgid")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // snake_case, unique within org
    label: text("label").notNull(),
    description: text("description").notNull(),
    category: skillCategoryEnum("category").notNull().default("custom"),
    inputschema: jsonb("inputschema").notNull(), // JSON Schema Draft 7
    handlerurl: text("handlerurl").notNull().default(""),
    // Stored server-side to enable the test console; NEVER included in API
    // responses except the one-time creation reply. (A production deployment
    // would encrypt this at rest / use a secrets manager.)
    skilltoken: text("skilltoken").notNull(),
    async: boolean("async").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    version: text("version").notNull().default("1.0.0"),
    createdby: skillCreatedByEnum("createdby").notNull().default("studio"),
    createdbyuserid: uuid("createdbyuserid").references(() => users.id, {
      onDelete: "set null",
    }),
    communityskillid: uuid("communityskillid"), // FK -> community catalog (spec 002), deferred
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("skills_orgid_name_key").on(t.orgid, t.name),
    index("skills_orgid_idx").on(t.orgid),
  ],
);

export const skillversions = ycSchema.table(
  "skillversions",
  {
    id: uuid("id").primaryKey(),
    skillid: uuid("skillid")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    previousversion: text("previousversion"),
    changedfields: text("changedfields").array(),
    schemadiff: jsonb("schemadiff"), // { before, after }
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
    updatedby: uuid("updatedby").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("skillversions_skillid_idx").on(t.skillid)],
);

export const skilltestlogs = ycSchema.table(
  "skilltestlogs",
  {
    id: uuid("id").primaryKey(),
    skillid: uuid("skillid")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    testedinput: jsonb("testedinput").notNull(),
    httpstatus: integer("httpstatus"),
    responsebody: jsonb("responsebody"),
    latencyms: integer("latencyms"),
    success: boolean("success").notNull().default(false),
    testedat: timestamp("testedat", { withTimezone: true }).notNull().defaultNow(),
    testedby: uuid("testedby").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("skilltestlogs_skillid_idx").on(t.skillid)],
);

export const agenttemplates = ycSchema.table(
  "agenttemplates",
  {
    id: uuid("id").primaryKey(),
    orgid: uuid("orgid")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    avatarurl: text("avatarurl").notNull().default(""),
    systemprompt: text("systemprompt").notNull().default(""),
    providerid: uuid("providerid"), // FK -> spec 002 aiproviders, deferred
    async: boolean("async").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    maxruntimeseconds: integer("maxruntimeseconds").notNull().default(600), // 60–3600
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agenttemplates_orgid_name_key").on(t.orgid, t.name),
    index("agenttemplates_orgid_idx").on(t.orgid),
  ],
);

export const agenttemplateskills = ycSchema.table(
  "agenttemplateskills",
  {
    id: uuid("id").primaryKey(),
    agenttemplateid: uuid("agenttemplateid")
      .notNull()
      .references(() => agenttemplates.id, { onDelete: "cascade" }),
    skillid: uuid("skillid")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("agenttemplateskills_template_skill_key").on(
      t.agenttemplateid,
      t.skillid,
    ),
  ],
);

export type SkillRow = typeof skills.$inferSelect;
export type AgentTemplateRow = typeof agenttemplates.$inferSelect;
