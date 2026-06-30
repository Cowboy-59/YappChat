CREATE TYPE "yappchat"."communitydiscoverability" AS ENUM('public', 'unlisted');--> statement-breakpoint
CREATE TYPE "yappchat"."communityjoinpolicy" AS ENUM('open', 'approval', 'invite');--> statement-breakpoint
CREATE TYPE "yappchat"."communityretention" AS ENUM('forever', 'days');--> statement-breakpoint
CREATE TYPE "yappchat"."communityrole" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "yappchat"."spacemode" AS ENUM('chat', 'broadcast');--> statement-breakpoint
CREATE TABLE "yappchat"."communities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"avatarurl" text,
	"ownerid" uuid NOT NULL,
	"channelid" uuid NOT NULL,
	"discoverability" "yappchat"."communitydiscoverability" DEFAULT 'unlisted' NOT NULL,
	"joinpolicy" "yappchat"."communityjoinpolicy" DEFAULT 'approval' NOT NULL,
	"retentionpolicy" "yappchat"."communityretention" DEFAULT 'forever' NOT NULL,
	"retentiondays" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."communitymembers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"communityid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"role" "yappchat"."communityrole" DEFAULT 'member' NOT NULL,
	"availabilitystatus" text,
	"availabilitynote" text,
	"joinedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."spaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"communityid" uuid NOT NULL,
	"conversationid" uuid NOT NULL,
	"name" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"mode" "yappchat"."spacemode" DEFAULT 'chat' NOT NULL,
	"discoverability" "yappchat"."communitydiscoverability",
	"joinpolicy" "yappchat"."communityjoinpolicy",
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."communities" ADD CONSTRAINT "communities_channelid_channels_id_fk" FOREIGN KEY ("channelid") REFERENCES "yappchat"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."communitymembers" ADD CONSTRAINT "communitymembers_communityid_communities_id_fk" FOREIGN KEY ("communityid") REFERENCES "yappchat"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."spaces" ADD CONSTRAINT "spaces_communityid_communities_id_fk" FOREIGN KEY ("communityid") REFERENCES "yappchat"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."spaces" ADD CONSTRAINT "spaces_conversationid_conversations_id_fk" FOREIGN KEY ("conversationid") REFERENCES "yappchat"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communities_slug_key" ON "yappchat"."communities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "communitymembers_comm_user_key" ON "yappchat"."communitymembers" USING btree ("communityid","userid");--> statement-breakpoint
CREATE INDEX "communitymembers_userid_idx" ON "yappchat"."communitymembers" USING btree ("userid");--> statement-breakpoint
CREATE INDEX "spaces_communityid_idx" ON "yappchat"."spaces" USING btree ("communityid");