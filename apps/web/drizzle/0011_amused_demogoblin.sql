CREATE TYPE "yappchat"."presentationattendeerole" AS ENUM('host', 'attendee');--> statement-breakpoint
CREATE TYPE "yappchat"."presentationstatus" AS ENUM('scheduled', 'live', 'ended', 'canceled');--> statement-breakpoint
CREATE TYPE "yappchat"."presentationvisibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "yappchat"."presentationrecordingstatus" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "yappchat"."presentationattendees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"presentationid" uuid NOT NULL,
	"userid" uuid,
	"guestname" text,
	"role" "yappchat"."presentationattendeerole" DEFAULT 'attendee' NOT NULL,
	"handraisedat" timestamp with time zone,
	"handresolvedat" timestamp with time zone,
	"joinedat" timestamp with time zone DEFAULT now() NOT NULL,
	"leftat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "yappchat"."presentationcaptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"presentationid" uuid NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"offsetms" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."presentationinvites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"presentationid" uuid NOT NULL,
	"kind" "yappchat"."presentationvisibility" NOT NULL,
	"tokenhash" text NOT NULL,
	"inviteduserid" uuid,
	"invitedemail" text,
	"createdby" uuid NOT NULL,
	"expiresat" timestamp with time zone,
	"revokedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."presentationrecordings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"presentationid" uuid NOT NULL,
	"mediaurl" text NOT NULL,
	"durationms" integer,
	"status" "yappchat"."presentationrecordingstatus" DEFAULT 'processing' NOT NULL,
	"deletedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."presentations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hostuserid" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"coverimageurl" text,
	"visibility" "yappchat"."presentationvisibility" DEFAULT 'private' NOT NULL,
	"communityid" uuid,
	"spokenlanguage" text DEFAULT 'en' NOT NULL,
	"scheduledstart" timestamp with time zone NOT NULL,
	"scheduledend" timestamp with time zone,
	"maxattendees" integer DEFAULT 100 NOT NULL,
	"status" "yappchat"."presentationstatus" DEFAULT 'scheduled' NOT NULL,
	"startedat" timestamp with time zone,
	"endedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."presentationattendees" ADD CONSTRAINT "presentationattendees_presentationid_presentations_id_fk" FOREIGN KEY ("presentationid") REFERENCES "yappchat"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."presentationcaptions" ADD CONSTRAINT "presentationcaptions_presentationid_presentations_id_fk" FOREIGN KEY ("presentationid") REFERENCES "yappchat"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."presentationinvites" ADD CONSTRAINT "presentationinvites_presentationid_presentations_id_fk" FOREIGN KEY ("presentationid") REFERENCES "yappchat"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."presentationrecordings" ADD CONSTRAINT "presentationrecordings_presentationid_presentations_id_fk" FOREIGN KEY ("presentationid") REFERENCES "yappchat"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."presentations" ADD CONSTRAINT "presentations_communityid_communities_id_fk" FOREIGN KEY ("communityid") REFERENCES "yappchat"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presentationattendees_presentationid_idx" ON "yappchat"."presentationattendees" USING btree ("presentationid");--> statement-breakpoint
CREATE INDEX "presentationattendees_pres_user_idx" ON "yappchat"."presentationattendees" USING btree ("presentationid","userid");--> statement-breakpoint
CREATE INDEX "presentationattendees_pres_hand_idx" ON "yappchat"."presentationattendees" USING btree ("presentationid","handraisedat");--> statement-breakpoint
CREATE INDEX "presentationcaptions_presentationid_idx" ON "yappchat"."presentationcaptions" USING btree ("presentationid");--> statement-breakpoint
CREATE UNIQUE INDEX "presentationinvites_tokenhash_key" ON "yappchat"."presentationinvites" USING btree ("tokenhash");--> statement-breakpoint
CREATE INDEX "presentationinvites_presentationid_idx" ON "yappchat"."presentationinvites" USING btree ("presentationid");--> statement-breakpoint
CREATE INDEX "presentationrecordings_presentationid_idx" ON "yappchat"."presentationrecordings" USING btree ("presentationid");--> statement-breakpoint
CREATE INDEX "presentations_hostuserid_idx" ON "yappchat"."presentations" USING btree ("hostuserid");--> statement-breakpoint
CREATE INDEX "presentations_communityid_idx" ON "yappchat"."presentations" USING btree ("communityid");--> statement-breakpoint
CREATE INDEX "presentations_status_start_idx" ON "yappchat"."presentations" USING btree ("status","scheduledstart");