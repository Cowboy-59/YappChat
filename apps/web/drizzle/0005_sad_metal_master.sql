CREATE TYPE "yappchat"."ackstate" AS ENUM('pending', 'acked', 'nacked');--> statement-breakpoint
CREATE TYPE "yappchat"."channelstatus" AS ENUM('healthy', 'degraded', 'offline');--> statement-breakpoint
CREATE TYPE "yappchat"."conversationkind" AS ENUM('channel', 'group', 'person', 'agent');--> statement-breakpoint
CREATE TYPE "yappchat"."msgdirection" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "yappchat"."msgencryptiontype" AS ENUM('e2e', 'agent-e2e', 'platform');--> statement-breakpoint
CREATE TYPE "yappchat"."msgtype" AS ENUM('chat', 'status');--> statement-breakpoint
CREATE TABLE "yappchat"."channelaccounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channelid" uuid NOT NULL,
	"accountid" text NOT NULL,
	"tokensource" text DEFAULT 'none' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."channels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"platformid" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"status" "yappchat"."channelstatus" DEFAULT 'offline' NOT NULL,
	"lastseenat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channelid" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"kind" "yappchat"."conversationkind" DEFAULT 'channel' NOT NULL,
	"externalid" text,
	"lastmessageat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."messagedeliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"messageid" uuid NOT NULL,
	"channelid" uuid NOT NULL,
	"ackstate" "yappchat"."ackstate" DEFAULT 'pending' NOT NULL,
	"retrycount" integer DEFAULT 0 NOT NULL,
	"error" text,
	"primaryplatformmessageid" text,
	"sentat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channelid" uuid NOT NULL,
	"conversationid" uuid,
	"platformmessageid" text,
	"authorid" text NOT NULL,
	"orgmemberid" uuid,
	"encryptiontype" "yappchat"."msgencryptiontype" DEFAULT 'platform' NOT NULL,
	"content" text,
	"encryptedpayload" "bytea",
	"encryptionkeyid" uuid,
	"mediaurl" text[],
	"messagetype" "yappchat"."msgtype" DEFAULT 'chat' NOT NULL,
	"direction" "yappchat"."msgdirection" NOT NULL,
	"ackstate" "yappchat"."ackstate" DEFAULT 'pending' NOT NULL,
	"ackedat" timestamp with time zone,
	"purgeat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."channelaccounts" ADD CONSTRAINT "channelaccounts_channelid_channels_id_fk" FOREIGN KEY ("channelid") REFERENCES "yappchat"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."conversations" ADD CONSTRAINT "conversations_channelid_channels_id_fk" FOREIGN KEY ("channelid") REFERENCES "yappchat"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."messagedeliveries" ADD CONSTRAINT "messagedeliveries_messageid_messages_id_fk" FOREIGN KEY ("messageid") REFERENCES "yappchat"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."messagedeliveries" ADD CONSTRAINT "messagedeliveries_channelid_channels_id_fk" FOREIGN KEY ("channelid") REFERENCES "yappchat"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."messages" ADD CONSTRAINT "messages_channelid_channels_id_fk" FOREIGN KEY ("channelid") REFERENCES "yappchat"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."messages" ADD CONSTRAINT "messages_conversationid_conversations_id_fk" FOREIGN KEY ("conversationid") REFERENCES "yappchat"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_platformid_idx" ON "yappchat"."channels" USING btree ("platformid");--> statement-breakpoint
CREATE INDEX "conversations_channelid_idx" ON "yappchat"."conversations" USING btree ("channelid");--> statement-breakpoint
CREATE INDEX "messagedeliveries_messageid_idx" ON "yappchat"."messagedeliveries" USING btree ("messageid");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_channel_platformmsg_key" ON "yappchat"."messages" USING btree ("channelid","platformmessageid");--> statement-breakpoint
CREATE INDEX "messages_conversationid_idx" ON "yappchat"."messages" USING btree ("conversationid");