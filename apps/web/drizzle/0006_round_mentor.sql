CREATE TABLE "yappchat"."wsevents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"scope" text NOT NULL,
	"payload" jsonb,
	"ts" bigint NOT NULL,
	"expiresat" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."wssessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"subscriptions" text[] DEFAULT '{}' NOT NULL,
	"connectedat" timestamp with time zone DEFAULT now() NOT NULL,
	"lastheartbeat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."wssessions" ADD CONSTRAINT "wssessions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wsevents_scope_id_idx" ON "yappchat"."wsevents" USING btree ("scope","id");--> statement-breakpoint
CREATE INDEX "wsevents_expiresat_idx" ON "yappchat"."wsevents" USING btree ("expiresat");