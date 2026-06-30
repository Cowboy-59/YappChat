ALTER TYPE "yappchat"."conversationkind" ADD VALUE 'space';--> statement-breakpoint
CREATE TABLE "yappchat"."conversationmembers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversationid" uuid NOT NULL,
	"userid" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"lastreadat" timestamp with time zone,
	"joinedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."conversationmembers" ADD CONSTRAINT "conversationmembers_conversationid_conversations_id_fk" FOREIGN KEY ("conversationid") REFERENCES "yappchat"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversationmembers_conv_user_key" ON "yappchat"."conversationmembers" USING btree ("conversationid","userid");--> statement-breakpoint
CREATE INDEX "conversationmembers_userid_idx" ON "yappchat"."conversationmembers" USING btree ("userid");