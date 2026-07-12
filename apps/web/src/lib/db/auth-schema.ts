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

/**
 * Spec 011 (auth-core slice) — data model.
 *
 * Project DB conventions: lowercase names, no separators, UUID v7 PKs (generated
 * in app via uuidv7()), FK columns = parent name + `id`.
 *
 * Scope note: `orgs` is nominally owned by spec 001; since 001 isn't built, the
 * minimal shape auth needs is defined here. (magiclinktokens/T003,
 * orginvitations + ssoidentities/T005/T007, devicesessions + agentapitokens/T006
 * have since landed below with their tasks.)
 *
 * Email is stored normalised to lowercase with a UNIQUE index (portable
 * equivalent of the spec's citext UNIQUE — avoids requiring the citext
 * extension). No JWTs: all tokens are opaque and stored only as SHA-256 hashes.
 */

export const planEnum = ycSchema.enum("plan", ["individual", "corporate"]);
export const plantypeEnum = ycSchema.enum("plantype", ["individual", "corporate"]);
export const userkindEnum = ycSchema.enum("userkind", ["human", "agent"]);
export const orgroleEnum = ycSchema.enum("orgrole", ["owner", "admin", "member"]);

export const users = ycSchema.table(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    displayname: text("displayname").notNull(),
    // Nullable: OAuth-only / passwordless accounts have no password (future).
    passwordhash: text("passwordhash"),
    kind: userkindEnum("kind").notNull().default("human"),
    plan: planEnum("plan").notNull().default("individual"),
    issystemadmin: boolean("issystemadmin").notNull().default(false),
    isbillingadmin: boolean("isbillingadmin").notNull().default(false),
    issupport: boolean("issupport").notNull().default(false),
    // Spec 068 — account profile (carried into every surface); nullable until set.
    bio: text("bio"),
    avatarurl: text("avatarurl"),
    preferredlanguage: text("preferredlanguage"),
    // Spec 068 (translation amendment) — global "always show messages in my
    // language" default. Target language = preferredlanguage. Off by default, so
    // the per-viewer opt-in invariant (017 FR-012) holds; a per-room override
    // lives on conversationmembers.autotranslate.
    autotranslate: boolean("autotranslate").notNull().default(false),
    emailverifiedat: timestamp("emailverifiedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const orgs = ycSchema.table("orgs", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  plantype: plantypeEnum("plantype").notNull().default("individual"),
  // null = unlimited (corporate); 1 for individual.
  seatlimit: integer("seatlimit"),
  createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
});

export const orgmemberships = ycSchema.table(
  "orgmemberships",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgid: uuid("orgid")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    role: orgroleEnum("role").notNull().default("member"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orgmemberships_userid_orgid_key").on(t.userid, t.orgid),
    index("orgmemberships_orgid_idx").on(t.orgid),
  ],
);

export const sessions = ycSchema.table(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 of the opaque session token; the plaintext lives only in the cookie.
    sessiontokenhash: text("sessiontokenhash").notNull(),
    deviceid: uuid("deviceid"),
    // Spec 011 T006 — captured at issuance for the device-session list. `ip` is
    // already anonymised (last v4 octet / low v6 bits zeroed) before write.
    ip: text("ip"),
    useragent: text("useragent"),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    lastusedat: timestamp("lastusedat", { withTimezone: true }).notNull().defaultNow(),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    revokedat: timestamp("revokedat", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_sessiontokenhash_key").on(t.sessiontokenhash),
    index("sessions_userid_idx").on(t.userid),
  ],
);

export const refreshtokens = ycSchema.table(
  "refreshtokens",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshtokenhash: text("refreshtokenhash").notNull(),
    // All tokens in one rotation chain share a familyid; reuse revokes the family.
    familyid: uuid("familyid").notNull(),
    sessionid: uuid("sessionid").references(() => sessions.id, {
      onDelete: "set null",
    }),
    // Self-reference set when this token is rotated out (reuse-detection signal).
    replacedbyid: uuid("replacedbyid"),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    rotatedat: timestamp("rotatedat", { withTimezone: true }),
    revokedat: timestamp("revokedat", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("refreshtokens_refreshtokenhash_key").on(t.refreshtokenhash),
    index("refreshtokens_familyid_idx").on(t.familyid),
  ],
);

export const magiclinktokens = ycSchema.table(
  "magiclinktokens",
  {
    id: uuid("id").primaryKey(),
    // Nullable: a magic link for a brand-new email has no user until consume,
    // when the account is created (frictionless onboarding). Email is carried so
    // consume can create that account.
    userid: uuid("userid").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenhash: text("tokenhash").notNull(),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    consumedat: timestamp("consumedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("magiclinktokens_tokenhash_key").on(t.tokenhash)],
);

export const emailverificationtokens = ycSchema.table(
  "emailverificationtokens",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenhash: text("tokenhash").notNull(),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    consumedat: timestamp("consumedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("emailverificationtokens_tokenhash_key").on(t.tokenhash)],
);

export const passwordresettokens = ycSchema.table(
  "passwordresettokens",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenhash: text("tokenhash").notNull(),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    consumedat: timestamp("consumedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("passwordresettokens_tokenhash_key").on(t.tokenhash)],
);

/**
 * Org member invitations (spec 011 T005 remainder) — invite a colleague by email
 * to join a company/org with a role. Opaque token; only its SHA-256 hash stored.
 * Single-use (consumedat) + expiring. Mirrors the auth token tables.
 */
export const orginvitations = ycSchema.table(
  "orginvitations",
  {
    id: uuid("id").primaryKey(),
    orgid: uuid("orgid")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgroleEnum("role").notNull().default("member"),
    tokenhash: text("tokenhash").notNull(),
    invitedby: uuid("invitedby"),
    expiresat: timestamp("expiresat", { withTimezone: true }).notNull(),
    consumedat: timestamp("consumedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orginvitations_tokenhash_key").on(t.tokenhash),
    index("orginvitations_orgid_idx").on(t.orgid),
  ],
);

/**
 * SSO / OIDC identities (spec 011 T007). Links an external provider account
 * (Google / Microsoft / generic OIDC) to a YappChat user. Auto-linked by verified
 * email or auto-provisioned on first sign-in. `subject` is the provider's stable
 * user id (the `sub` claim).
 */
export const ssoidentities = ycSchema.table(
  "ssoidentities",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google" | "microsoft" | "oidc"
    subject: text("subject").notNull(),
    email: text("email"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ssoidentities_provider_subject_key").on(t.provider, t.subject),
    index("ssoidentities_userid_idx").on(t.userid),
  ],
);

/**
 * Device session registry (spec 011 T006). Joins userid ↔ deviceid ↔ sessionid.
 * The `deviceid` is the cross-spec key shared with specs 008 (mobiledevices),
 * 009 (pushtokens), 001 (userencryptionkeys) and 010 (keypairings) so one device
 * resolves across all of them. Populated when a session is issued WITH a deviceid
 * (mobile/desktop pairing); web browser sessions have no deviceid yet.
 */
export const devicesessions = ycSchema.table(
  "devicesessions",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceid: uuid("deviceid").notNull(),
    sessionid: uuid("sessionid")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    revokedat: timestamp("revokedat", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("devicesessions_userid_deviceid_sessionid_key").on(t.userid, t.deviceid, t.sessionid),
    index("devicesessions_userid_idx").on(t.userid),
  ],
);

/**
 * AI agent API tokens (spec 011 T006 / FR-015, per spec 001 FR-010). The agent
 * principal is a `users` row with kind='agent' (no separate agents table yet).
 * Only the SHA-256 hash is stored; `last6` is the trailing plaintext shown in
 * listings. Bearer-auth resolves a request to that agent user.
 */
export const agentapitokens = ycSchema.table(
  "agentapitokens",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    tokenhash: text("tokenhash").notNull(),
    last6: text("last6").notNull(),
    createdby: uuid("createdby"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    revokedat: timestamp("revokedat", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("agentapitokens_tokenhash_key").on(t.tokenhash),
    index("agentapitokens_userid_idx").on(t.userid),
  ],
);

export const authauditlog = ycSchema.table(
  "authauditlog",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid"),
    eventtype: text("eventtype").notNull(),
    // IP anonymised before write (last v4 octet / last 80 v6 bits zeroed).
    ip: text("ip"),
    payload: jsonb("payload"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("authauditlog_userid_idx").on(t.userid)],
);

export type UserRow = typeof users.$inferSelect;
export type OrgRow = typeof orgs.$inferSelect;
export type OrgInvitationRow = typeof orginvitations.$inferSelect;
