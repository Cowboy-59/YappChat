CREATE TYPE "yappchat"."supportstatus" AS ENUM('open', 'assigned', 'closed');--> statement-breakpoint
ALTER TYPE "yappchat"."conversationkind" ADD VALUE 'support';--> statement-breakpoint
CREATE TABLE "yappchat"."supportsessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversationid" uuid NOT NULL,
	"orgid" uuid NOT NULL,
	"appkey" text NOT NULL,
	"status" "yappchat"."supportstatus" DEFAULT 'open' NOT NULL,
	"requesterid" text NOT NULL,
	"assignedagentid" uuid,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"closedat" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "yappchat"."supportsessions" ADD CONSTRAINT "supportsessions_conversationid_conversations_id_fk" FOREIGN KEY ("conversationid") REFERENCES "yappchat"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."supportsessions" ADD CONSTRAINT "supportsessions_orgid_orgs_id_fk" FOREIGN KEY ("orgid") REFERENCES "yappchat"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supportsessions_orgid_status_idx" ON "yappchat"."supportsessions" USING btree ("orgid","status");--> statement-breakpoint
CREATE INDEX "supportsessions_conversationid_idx" ON "yappchat"."supportsessions" USING btree ("conversationid");