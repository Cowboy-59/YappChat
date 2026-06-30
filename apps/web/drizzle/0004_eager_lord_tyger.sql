CREATE TYPE "yappchat"."invokedby" AS ENUM('pa', 'subagent', 'studio_test');--> statement-breakpoint
CREATE TABLE "yappchat"."skillinvocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"skillid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"sessionid" uuid,
	"subagentexecutionid" uuid,
	"invokedby" "yappchat"."invokedby" DEFAULT 'pa' NOT NULL,
	"arguments" jsonb,
	"httpstatus" integer,
	"responsebody" jsonb,
	"errormessage" text,
	"latencyms" integer,
	"success" boolean DEFAULT false NOT NULL,
	"invokedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."skillinvocations" ADD CONSTRAINT "skillinvocations_skillid_skills_id_fk" FOREIGN KEY ("skillid") REFERENCES "yappchat"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skillinvocations" ADD CONSTRAINT "skillinvocations_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skillinvocations" ADD CONSTRAINT "skillinvocations_sessionid_assistantsessions_id_fk" FOREIGN KEY ("sessionid") REFERENCES "yappchat"."assistantsessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skillinvocations_skillid_idx" ON "yappchat"."skillinvocations" USING btree ("skillid");