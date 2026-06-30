CREATE TYPE "yappchat"."joinrequeststatus" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "yappchat"."communityauditlog" (
	"id" uuid PRIMARY KEY NOT NULL,
	"communityid" uuid NOT NULL,
	"actorid" uuid NOT NULL,
	"eventtype" text NOT NULL,
	"payload" jsonb,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."communityinvites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"communityid" uuid NOT NULL,
	"tokenhash" text NOT NULL,
	"createdby" uuid NOT NULL,
	"expiresat" timestamp with time zone NOT NULL,
	"usedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."joinrequests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"communityid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"status" "yappchat"."joinrequeststatus" DEFAULT 'pending' NOT NULL,
	"message" text,
	"requestedat" timestamp with time zone DEFAULT now() NOT NULL,
	"decidedby" uuid,
	"decidedat" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "yappchat"."communityauditlog" ADD CONSTRAINT "communityauditlog_communityid_communities_id_fk" FOREIGN KEY ("communityid") REFERENCES "yappchat"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."communityinvites" ADD CONSTRAINT "communityinvites_communityid_communities_id_fk" FOREIGN KEY ("communityid") REFERENCES "yappchat"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."joinrequests" ADD CONSTRAINT "joinrequests_communityid_communities_id_fk" FOREIGN KEY ("communityid") REFERENCES "yappchat"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communityauditlog_communityid_idx" ON "yappchat"."communityauditlog" USING btree ("communityid");--> statement-breakpoint
CREATE UNIQUE INDEX "communityinvites_tokenhash_key" ON "yappchat"."communityinvites" USING btree ("tokenhash");--> statement-breakpoint
CREATE INDEX "joinrequests_community_status_idx" ON "yappchat"."joinrequests" USING btree ("communityid","status");--> statement-breakpoint
CREATE INDEX "joinrequests_userid_idx" ON "yappchat"."joinrequests" USING btree ("userid");