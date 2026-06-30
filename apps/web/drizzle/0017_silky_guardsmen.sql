CREATE TABLE "yappchat"."ssoidentities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."ssoidentities" ADD CONSTRAINT "ssoidentities_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ssoidentities_provider_subject_key" ON "yappchat"."ssoidentities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "ssoidentities_userid_idx" ON "yappchat"."ssoidentities" USING btree ("userid");