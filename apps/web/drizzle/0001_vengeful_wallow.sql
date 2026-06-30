CREATE TABLE "yappchat"."magiclinktokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid,
	"email" text NOT NULL,
	"tokenhash" text NOT NULL,
	"expiresat" timestamp with time zone NOT NULL,
	"consumedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."magiclinktokens" ADD CONSTRAINT "magiclinktokens_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "magiclinktokens_tokenhash_key" ON "yappchat"."magiclinktokens" USING btree ("tokenhash");