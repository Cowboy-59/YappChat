import { boolean, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import { spaces } from "./communities-schema";
import { presentationrecordings } from "./presentations-schema";

/**
 * Spec 092 (Training) T001 — a self-paced course library scoped to a community
 * space. An author (any presentation host — in practice any member of the space,
 * see the training service) assembles a **course**: an ordered list of **items**,
 * each one of three types — a reference to a past presentation recording (spec
 * 071, no copy), an uploaded standalone training video (its own S3 `mediakey`),
 * or a document (S3 `documentkey`). Learners work through a course and mark each
 * item complete; completion is per-user and private.
 *
 * Conventions (matching presentations-schema): all tables live in `yappchat`;
 * `id` is an app-generated UUID v7; `createdby`/`userid` are `users.id` kept
 * FK-LESS to stay decoupled from auth-schema, while in-schema relationships use
 * real cascading FKs. Access follows the owning space's membership; there is no
 * per-course visibility of its own (unlike spec 071 presentations).
 */

// The three kinds of training item. Exactly one of the payload columns on
// `trainingitems` is set, keyed by this type.
export const trainingItemTypeEnum = ycSchema.enum("trainingitemtype", [
  "recording", // references presentationrecordings (spec 071), no copy
  "video", // a standalone uploaded video, stored under its own mediakey
  "document", // a PDF/doc, stored under documentkey, viewed inline
]);

export const trainingcourses = ycSchema.table(
  "trainingcourses",
  {
    id: uuid("id").primaryKey(),
    // The owning space governs all access to this course and its items.
    spaceid: uuid("spaceid")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // Author (FK-less -> users.id). Any presentation host who belongs to the space.
    createdby: uuid("createdby").notNull(),
    // Unpublished courses are visible only to authors (space members) in edit mode.
    published: boolean("published").notNull().default(false),
    // Order of this course within the space's Training library.
    position: integer("position").notNull().default(0),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("trainingcourses_spaceid_idx").on(t.spaceid)],
);

export const trainingitems = ycSchema.table(
  "trainingitems",
  {
    id: uuid("id").primaryKey(),
    courseid: uuid("courseid")
      .notNull()
      .references(() => trainingcourses.id, { onDelete: "cascade" }),
    // Order of this item within its course.
    position: integer("position").notNull().default(0),
    type: trainingItemTypeEnum("type").notNull(),
    title: text("title").notNull(),
    // Exactly one of the following is set, per `type`:
    // - recording: a reference to a spec 071 recording (set null if that recording
    //   row is ever removed — the item survives, just no longer playable).
    presentationrecordingid: uuid("presentationrecordingid").references(
      () => presentationrecordings.id,
      { onDelete: "set null" },
    ),
    // - video: the S3 key of an uploaded standalone training video.
    mediakey: text("mediakey"),
    // - document: the S3 key of an uploaded document (PDF/doc/slides).
    documentkey: text("documentkey"),
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Ordered items per course.
    index("trainingitems_course_pos_idx").on(t.courseid, t.position),
  ],
);

export const trainingprogress = ycSchema.table(
  "trainingprogress",
  {
    id: uuid("id").primaryKey(),
    itemid: uuid("itemid")
      .notNull()
      .references(() => trainingitems.id, { onDelete: "cascade" }),
    // The learner (FK-less -> users.id). Completion is per-user and private.
    userid: uuid("userid").notNull(),
    completedat: timestamp("completedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One completion row per (item, learner) — mark-complete is idempotent.
    uniqueIndex("trainingprogress_item_user_key").on(t.itemid, t.userid),
    // Fast lookup of a learner's completed items across a course's items.
    index("trainingprogress_user_idx").on(t.userid),
  ],
);

export type TrainingCourseRow = typeof trainingcourses.$inferSelect;
export type TrainingItemRow = typeof trainingitems.$inferSelect;
export type TrainingProgressRow = typeof trainingprogress.$inferSelect;
export type TrainingItemType = (typeof trainingItemTypeEnum.enumValues)[number];
