CREATE TYPE "yappchat"."contactstatus" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "yappchat"."contactinvites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"inviterid" uuid NOT NULL,
	"email" text NOT NULL,
	"tokenhash" text NOT NULL,
	"expiresat" timestamp with time zone NOT NULL,
	"consumedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"requesterid" uuid NOT NULL,
	"addresseeid" uuid NOT NULL,
	"status" "yappchat"."contactstatus" DEFAULT 'pending' NOT NULL,
	"conversationid" uuid,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"respondedat" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "yappchat"."contactinvites" ADD CONSTRAINT "contactinvites_inviterid_users_id_fk" FOREIGN KEY ("inviterid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."contacts" ADD CONSTRAINT "contacts_requesterid_users_id_fk" FOREIGN KEY ("requesterid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."contacts" ADD CONSTRAINT "contacts_addresseeid_users_id_fk" FOREIGN KEY ("addresseeid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contactinvites_tokenhash_key" ON "yappchat"."contactinvites" USING btree ("tokenhash");--> statement-breakpoint
CREATE INDEX "contactinvites_inviter_idx" ON "yappchat"."contactinvites" USING btree ("inviterid");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_pair_key" ON "yappchat"."contacts" USING btree ("requesterid","addresseeid");--> statement-breakpoint
CREATE INDEX "contacts_addressee_idx" ON "yappchat"."contacts" USING btree ("addresseeid");--> statement-breakpoint
CREATE INDEX "contacts_requester_idx" ON "yappchat"."contacts" USING btree ("requesterid");