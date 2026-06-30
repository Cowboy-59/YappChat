CREATE TABLE "yappchat"."orginvitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"orgid" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "yappchat"."orgrole" DEFAULT 'member' NOT NULL,
	"tokenhash" text NOT NULL,
	"invitedby" uuid,
	"expiresat" timestamp with time zone NOT NULL,
	"consumedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."orginvitations" ADD CONSTRAINT "orginvitations_orgid_orgs_id_fk" FOREIGN KEY ("orgid") REFERENCES "yappchat"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orginvitations_tokenhash_key" ON "yappchat"."orginvitations" USING btree ("tokenhash");--> statement-breakpoint
CREATE INDEX "orginvitations_orgid_idx" ON "yappchat"."orginvitations" USING btree ("orgid");