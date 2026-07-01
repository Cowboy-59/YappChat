import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { channels, conversations } from "./engine-schema";

/**
 * Spec 017 (Communities) T001 — community structure.
 *
 * A community owns a backing native `yappchat-internal` channel (the engine
 * "connection"); its spaces are spec 001 conversations of kind `space` under
 * that channel. Identity (name/bio/language/avatar) is the spec 011 ACCOUNT
 * profile — NOT stored here; `communitymembers` adds only per-community role +
 * availability. `userid`/`ownerid` are `users.id` (FK-less to keep this schema
 * decoupled from auth-schema, matching the engine-schema convention).
 */

export const communityDiscoverabilityEnum = ycSchema.enum("communitydiscoverability", [
  "public",
  "unlisted",
]);
export const communityJoinPolicyEnum = ycSchema.enum("communityjoinpolicy", [
  "open",
  "approval",
  "invite",
]);
export const communityRoleEnum = ycSchema.enum("communityrole", ["owner", "moderator", "member"]);
export const spaceModeEnum = ycSchema.enum("spacemode", ["chat", "broadcast"]);
export const communityRetentionEnum = ycSchema.enum("communityretention", ["forever", "days"]);

export const communities = ycSchema.table(
  "communities",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    avatarurl: text("avatarurl"),
    ownerid: uuid("ownerid").notNull(),
    // Backing native connection (the yappchat-internal channel that hosts spaces).
    channelid: uuid("channelid")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    discoverability: communityDiscoverabilityEnum("discoverability").notNull().default("unlisted"),
    joinpolicy: communityJoinPolicyEnum("joinpolicy").notNull().default("approval"),
    retentionpolicy: communityRetentionEnum("retentionpolicy").notNull().default("forever"),
    retentiondays: integer("retentiondays"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("communities_slug_key").on(t.slug)],
);

export const communitymembers = ycSchema.table(
  "communitymembers",
  {
    id: uuid("id").primaryKey(),
    communityid: uuid("communityid")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userid: uuid("userid").notNull(),
    role: communityRoleEnum("role").notNull().default("member"),
    // Per-community availability ("available to help"); profile lives in spec 011.
    availabilitystatus: text("availabilitystatus"),
    availabilitynote: text("availabilitynote"),
    joinedat: timestamp("joinedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("communitymembers_comm_user_key").on(t.communityid, t.userid),
    index("communitymembers_userid_idx").on(t.userid),
  ],
);

export const spaces = ycSchema.table(
  "spaces",
  {
    id: uuid("id").primaryKey(),
    communityid: uuid("communityid")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    // The spec 001 conversation (kind `space`) that carries this space's messages.
    conversationid: uuid("conversationid")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    topic: text("topic").notNull().default(""),
    mode: spaceModeEnum("mode").notNull().default("chat"),
    // NULL = inherit the community's setting; a space may override STRICTER only.
    discoverability: communityDiscoverabilityEnum("discoverability"),
    joinpolicy: communityJoinPolicyEnum("joinpolicy"),
    // Admin space (auto-created with the community): membership is role-driven —
    // only owners + moderators are members; regular members never auto-join.
    adminonly: boolean("adminonly").notNull().default(false),
    // Corp space: only members of the community owner's ORGANIZATION (the corp)
    // — plus owners/mods — are members. Regular (non-corp) members never join.
    corponly: boolean("corponly").notNull().default(false),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("spaces_communityid_idx").on(t.communityid)],
);

/**
 * Spec 017 T002 — join / approval / moderation.
 */
export const joinRequestStatusEnum = ycSchema.enum("joinrequeststatus", [
  "pending",
  "approved",
  "denied",
]);

export const joinrequests = ycSchema.table(
  "joinrequests",
  {
    id: uuid("id").primaryKey(),
    communityid: uuid("communityid")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userid: uuid("userid").notNull(),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    requestedat: timestamp("requestedat", { withTimezone: true }).notNull().defaultNow(),
    decidedby: uuid("decidedby"),
    decidedat: timestamp("decidedat", { withTimezone: true }),
  },
  (t) => [
    index("joinrequests_community_status_idx").on(t.communityid, t.status),
    index("joinrequests_userid_idx").on(t.userid),
  ],
);

export const communityinvites = ycSchema.table(
  "communityinvites",
  {
    id: uuid("id").primaryKey(),
    communityid: uuid("communityid")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    // NULL = community-wide invite (FR-004); set = per-space invite (FR-020) that
    // admits the redeemer directly into this space, overriding its strict policy.
    spaceid: uuid("spaceid").references(() => spaces.id, { onDelete: "cascade" }),
    tokenhash: text("tokenhash").notNull(), // sha-256 of the invite token; plaintext shown once
    createdby: uuid("createdby").notNull(),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    usedat: timestamp("usedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("communityinvites_tokenhash_key").on(t.tokenhash),
    index("communityinvites_spaceid_idx").on(t.spaceid),
  ],
);

export const communityauditlog = ycSchema.table(
  "communityauditlog",
  {
    id: uuid("id").primaryKey(),
    communityid: uuid("communityid")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    actorid: uuid("actorid").notNull(),
    eventtype: text("eventtype").notNull(),
    payload: jsonb("payload"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("communityauditlog_communityid_idx").on(t.communityid)],
);

/**
 * Spec 017 FR-019 — per-space support AI (source-grounded auto-answer).
 *
 * A space may opt in to an AI assistant grounded ONLY in owner-provided sources
 * (a crawled website snapshot, uploaded documents, and/or the space's own
 * history). Source text is chunked into `spaceaichunks` and retrieved at
 * question time (Postgres full-text in v1; a pgvector embedding column is the
 * planned follow-up). This is DISTINCT from the community-wide history RAG of
 * FR-015. Retrieval is hard-scoped to a single space via `spaceid`.
 */
export const spaceAiSourceKindEnum = ycSchema.enum("spaceaisourcekind", [
  "website",
  "document",
  "history",
]);
export const spaceAiSourceStatusEnum = ycSchema.enum("spaceaisourcestatus", [
  "pending",
  "indexing",
  "ready",
  "error",
]);

export const spaceaiconfig = ycSchema.table(
  "spaceaiconfig",
  {
    id: uuid("id").primaryKey(),
    spaceid: uuid("spaceid")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    // Latest Claude by default; owner-overridable via the spec 002 provider.
    model: text("model").notNull().default("claude-opus-4-8"),
    // Auto-answer: the bot replies on its own to question-shaped messages.
    autoanswer: boolean("autoanswer").notNull().default(true),
    // Also retrieve over the space's own message history as a source.
    includehistory: boolean("includehistory").notNull().default(false),
    lastindexedat: timestamp("lastindexedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("spaceaiconfig_spaceid_key").on(t.spaceid)],
);

export const spaceaisources = ycSchema.table(
  "spaceaisources",
  {
    id: uuid("id").primaryKey(),
    spaceid: uuid("spaceid")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    kind: spaceAiSourceKindEnum("kind").notNull(),
    // For kind=website: the seed URL crawled once into a snapshot.
    url: text("url"),
    // For kind=document: the S3 key from /api/upload.
    storagekey: text("storagekey"),
    title: text("title").notNull().default(""),
    status: spaceAiSourceStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    pagecount: integer("pagecount"),
    crawledat: timestamp("crawledat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("spaceaisources_spaceid_idx").on(t.spaceid)],
);

export const spaceaichunks = ycSchema.table(
  "spaceaichunks",
  {
    id: uuid("id").primaryKey(),
    // Denormalized for the hard per-space retrieval scope (never cross spaces).
    spaceid: uuid("spaceid")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    sourceid: uuid("sourceid")
      .notNull()
      .references(() => spaceaisources.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // Citation anchor: a page URL, a "p.N" page marker, or a section heading.
    anchor: text("anchor").notNull().default(""),
    tokens: integer("tokens"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  // A GIN full-text index on to_tsvector(content) is added by hand in the
  // migration (drizzle-kit can't express expression indexes); see 0012 SQL.
  (t) => [index("spaceaichunks_spaceid_idx").on(t.spaceid)],
);

export type CommunityRow = typeof communities.$inferSelect;
export type CommunityMemberRow = typeof communitymembers.$inferSelect;
export type SpaceRow = typeof spaces.$inferSelect;
export type JoinRequestRow = typeof joinrequests.$inferSelect;
export type CommunityInviteRow = typeof communityinvites.$inferSelect;
export type SpaceAiConfigRow = typeof spaceaiconfig.$inferSelect;
export type SpaceAiSourceRow = typeof spaceaisources.$inferSelect;
export type SpaceAiChunkRow = typeof spaceaichunks.$inferSelect;
export type SpaceAiSourceKind = (typeof spaceAiSourceKindEnum.enumValues)[number];
export type CommunityRole = (typeof communityRoleEnum.enumValues)[number];
export type JoinPolicy = (typeof communityJoinPolicyEnum.enumValues)[number];
export type Discoverability = (typeof communityDiscoverabilityEnum.enumValues)[number];
