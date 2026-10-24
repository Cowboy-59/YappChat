-- Spec 092 (Training) T001 — self-paced course library scoped to a community space.
-- Hand-authored (not via db:generate) because the drizzle snapshot journal is
-- stuck at 0019 and re-diffs already-applied 0020–0029; this file carries ONLY the
-- three new training tables + their enum, FKs, and indexes.

CREATE TYPE "yappchat"."trainingitemtype" AS ENUM('recording', 'video', 'document');--> statement-breakpoint
CREATE TABLE "yappchat"."trainingcourses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spaceid" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"createdby" uuid NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."trainingitems" (
	"id" uuid PRIMARY KEY NOT NULL,
	"courseid" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" "yappchat"."trainingitemtype" NOT NULL,
	"title" text NOT NULL,
	"presentationrecordingid" uuid,
	"mediakey" text,
	"documentkey" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."trainingprogress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"itemid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"completedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."trainingcourses" ADD CONSTRAINT "trainingcourses_spaceid_spaces_id_fk" FOREIGN KEY ("spaceid") REFERENCES "yappchat"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."trainingitems" ADD CONSTRAINT "trainingitems_courseid_trainingcourses_id_fk" FOREIGN KEY ("courseid") REFERENCES "yappchat"."trainingcourses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."trainingitems" ADD CONSTRAINT "trainingitems_presentationrecordingid_presentationrecordings_id_fk" FOREIGN KEY ("presentationrecordingid") REFERENCES "yappchat"."presentationrecordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."trainingprogress" ADD CONSTRAINT "trainingprogress_itemid_trainingitems_id_fk" FOREIGN KEY ("itemid") REFERENCES "yappchat"."trainingitems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trainingcourses_spaceid_idx" ON "yappchat"."trainingcourses" USING btree ("spaceid");--> statement-breakpoint
CREATE INDEX "trainingitems_course_pos_idx" ON "yappchat"."trainingitems" USING btree ("courseid","position");--> statement-breakpoint
CREATE UNIQUE INDEX "trainingprogress_item_user_key" ON "yappchat"."trainingprogress" USING btree ("itemid","userid");--> statement-breakpoint
CREATE INDEX "trainingprogress_user_idx" ON "yappchat"."trainingprogress" USING btree ("userid");
