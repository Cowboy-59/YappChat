import { index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { communities } from "./communities-schema";

/**
 * Spec 071 (Presentation) T001 — live broadcast-style screen-share presentations.
 *
 * A host schedules a presentation, shares their screen + audio (broadcast over
 * LiveKit), and attendees join via a public (guest-friendly) or private invite
 * link. Realtime presence/room signalling reuses the spec 003 `videoroom` scope;
 * in-session chat reuses the spec 001 engine — neither adds a table here.
 *
 * Conventions (matching communities-schema): all tables live in `yappchat`;
 * `id` is an app-generated UUID v7; `userid`/`hostuserid`/`createdby` are
 * `users.id` kept FK-LESS to stay decoupled from auth-schema, while in-schema
 * relationships (presentationid -> presentations.id) use real cascading FKs.
 * Invite links are stored as a `tokenhash` (sha-256; the plaintext token is shown
 * once), mirroring `communityinvites`.
 */

// public link admits anonymous guests; private requires an invite + sign-in.
// Shared by presentations.visibility and the access a single invite grants.
export const presentationVisibilityEnum = ycSchema.enum("presentationvisibility", [
  "public",
  "private",
]);
export const presentationStatusEnum = ycSchema.enum("presentationstatus", [
  "scheduled",
  "live",
  "ended",
  "canceled",
]);
export const presentationAttendeeRoleEnum = ycSchema.enum("presentationattendeerole", [
  "host",
  "attendee",
]);
export const recordingStatusEnum = ycSchema.enum("presentationrecordingstatus", [
  "processing",
  "ready",
  "failed",
]);

export const presentations = ycSchema.table(
  "presentations",
  {
    id: uuid("id").primaryKey(),
    hostuserid: uuid("hostuserid").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // S3 key or preset path; resolved on read like spec 068 avatars (nullable = none).
    coverimageurl: text("coverimageurl"),
    visibility: presentationVisibilityEnum("visibility").notNull().default("private"),
    // Optional attach to a spec 017 community; if the community is deleted the
    // presentation survives as standalone (set null), never cascade-deleted.
    communityid: uuid("communityid").references(() => communities.id, { onDelete: "set null" }),
    // Base language the presenter speaks; captions are produced in it (one of the
    // five supported codes en/fr/es/de/pt — enforced at the app/zod layer).
    spokenlanguage: text("spokenlanguage").notNull().default("en"),
    scheduledstart: timestamp("scheduledstart", { withTimezone: true }).notNull(),
    scheduledend: timestamp("scheduledend", { withTimezone: true }),
    // Hard cap (spec 071 v1 = 100); joins beyond it are refused ("room full").
    maxattendees: integer("maxattendees").notNull().default(100),
    status: presentationStatusEnum("status").notNull().default("scheduled"),
    startedat: timestamp("startedat", { withTimezone: true }),
    endedat: timestamp("endedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("presentations_hostuserid_idx").on(t.hostuserid),
    index("presentations_communityid_idx").on(t.communityid),
    // Calendar view: upcoming/past by schedule, narrowed by status.
    index("presentations_status_start_idx").on(t.status, t.scheduledstart),
  ],
);

export const presentationinvites = ycSchema.table(
  "presentationinvites",
  {
    id: uuid("id").primaryKey(),
    presentationid: uuid("presentationid")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    kind: presentationVisibilityEnum("kind").notNull(),
    tokenhash: text("tokenhash").notNull(), // sha-256 of the invite token; plaintext shown once
    // For a targeted private invite (FK-less -> users.id); null for a shareable link.
    inviteduserid: uuid("inviteduserid"),
    invitedemail: text("invitedemail"),
    createdby: uuid("createdby").notNull(),
    expiresat: timestamp("expiresat", { withTimezone: true }),
    revokedat: timestamp("revokedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("presentationinvites_tokenhash_key").on(t.tokenhash),
    index("presentationinvites_presentationid_idx").on(t.presentationid),
  ],
);

export const presentationattendees = ycSchema.table(
  "presentationattendees",
  {
    id: uuid("id").primaryKey(),
    presentationid: uuid("presentationid")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    // userid is null for an anonymous guest (public link); guestname is then set.
    userid: uuid("userid"),
    guestname: text("guestname"),
    role: presentationAttendeeRoleEnum("role").notNull().default("attendee"),
    // Raise-hand queue: handraisedat set when raised, handresolvedat when the host
    // answers/dismisses; both null = not currently in the queue.
    handraisedat: timestamp("handraisedat", { withTimezone: true }),
    handresolvedat: timestamp("handresolvedat", { withTimezone: true }),
    joinedat: timestamp("joinedat", { withTimezone: true }).notNull().defaultNow(),
    leftat: timestamp("leftat", { withTimezone: true }),
  },
  (t) => [
    index("presentationattendees_presentationid_idx").on(t.presentationid),
    index("presentationattendees_pres_user_idx").on(t.presentationid, t.userid),
    // Ordered hand-raise queue per presentation.
    index("presentationattendees_pres_hand_idx").on(t.presentationid, t.handraisedat),
  ],
);

export const presentationcaptions = ycSchema.table(
  "presentationcaptions",
  {
    id: uuid("id").primaryKey(),
    presentationid: uuid("presentationid")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    // Base spoken-language line; per-viewer translations are derived live, not stored.
    language: text("language").notNull(),
    text: text("text").notNull(),
    // Offset from session start (ms) for aligning captions to the recording on replay.
    offsetms: integer("offsetms"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("presentationcaptions_presentationid_idx").on(t.presentationid)],
);

export const presentationrecordings = ycSchema.table(
  "presentationrecordings",
  {
    id: uuid("id").primaryKey(),
    presentationid: uuid("presentationid")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    mediaurl: text("mediaurl").notNull(), // S3 key from LiveKit egress
    durationms: integer("durationms"),
    status: recordingStatusEnum("status").notNull().default("processing"),
    // Retained indefinitely; soft-deleted on host delete (no auto-expiry).
    deletedat: timestamp("deletedat", { withTimezone: true }),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("presentationrecordings_presentationid_idx").on(t.presentationid)],
);

export type PresentationRow = typeof presentations.$inferSelect;
export type NewPresentationRow = typeof presentations.$inferInsert;
export type PresentationInviteRow = typeof presentationinvites.$inferSelect;
export type PresentationAttendeeRow = typeof presentationattendees.$inferSelect;
export type PresentationCaptionRow = typeof presentationcaptions.$inferSelect;
export type PresentationRecordingRow = typeof presentationrecordings.$inferSelect;
export type PresentationVisibility = (typeof presentationVisibilityEnum.enumValues)[number];
export type PresentationStatus = (typeof presentationStatusEnum.enumValues)[number];
export type PresentationAttendeeRole = (typeof presentationAttendeeRoleEnum.enumValues)[number];
export type PresentationRecordingStatus = (typeof recordingStatusEnum.enumValues)[number];
