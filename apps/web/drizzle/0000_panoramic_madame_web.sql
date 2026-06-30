CREATE TYPE "yappchat"."orgrole" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "yappchat"."plan" AS ENUM('individual', 'corporate');--> statement-breakpoint
CREATE TYPE "yappchat"."plantype" AS ENUM('individual', 'corporate');--> statement-breakpoint
CREATE TYPE "yappchat"."userkind" AS ENUM('human', 'agent');--> statement-breakpoint
CREATE TABLE "yappchat"."landingpageconfig" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deploymentid" text NOT NULL,
	"branding" jsonb NOT NULL,
	"seo" jsonb NOT NULL,
	"plans" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"faq" jsonb NOT NULL,
	"testimonials" jsonb NOT NULL,
	"security" jsonb NOT NULL,
	"downloads" jsonb NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedby" uuid
);
--> statement-breakpoint
CREATE TABLE "yappchat"."authauditlog" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid,
	"eventtype" text NOT NULL,
	"ip" text,
	"payload" jsonb,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."emailverificationtokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"tokenhash" text NOT NULL,
	"expiresat" timestamp with time zone NOT NULL,
	"consumedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."orgmemberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"orgid" uuid NOT NULL,
	"role" "yappchat"."orgrole" DEFAULT 'member' NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."orgs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plantype" "yappchat"."plantype" DEFAULT 'individual' NOT NULL,
	"seatlimit" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."passwordresettokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"tokenhash" text NOT NULL,
	"expiresat" timestamp with time zone NOT NULL,
	"consumedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."refreshtokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"refreshtokenhash" text NOT NULL,
	"familyid" uuid NOT NULL,
	"sessionid" uuid,
	"replacedbyid" uuid,
	"expiresat" timestamp with time zone NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"rotatedat" timestamp with time zone,
	"revokedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "yappchat"."sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"sessiontokenhash" text NOT NULL,
	"deviceid" uuid,
	"expiresat" timestamp with time zone NOT NULL,
	"lastusedat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "yappchat"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"displayname" text NOT NULL,
	"passwordhash" text,
	"kind" "yappchat"."userkind" DEFAULT 'human' NOT NULL,
	"plan" "yappchat"."plan" DEFAULT 'individual' NOT NULL,
	"issystemadmin" boolean DEFAULT false NOT NULL,
	"isbillingadmin" boolean DEFAULT false NOT NULL,
	"issupport" boolean DEFAULT false NOT NULL,
	"emailverifiedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."emailverificationtokens" ADD CONSTRAINT "emailverificationtokens_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."orgmemberships" ADD CONSTRAINT "orgmemberships_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."orgmemberships" ADD CONSTRAINT "orgmemberships_orgid_orgs_id_fk" FOREIGN KEY ("orgid") REFERENCES "yappchat"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."passwordresettokens" ADD CONSTRAINT "passwordresettokens_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."refreshtokens" ADD CONSTRAINT "refreshtokens_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."refreshtokens" ADD CONSTRAINT "refreshtokens_sessionid_sessions_id_fk" FOREIGN KEY ("sessionid") REFERENCES "yappchat"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."sessions" ADD CONSTRAINT "sessions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "landingpageconfig_deploymentid_key" ON "yappchat"."landingpageconfig" USING btree ("deploymentid");--> statement-breakpoint
CREATE INDEX "authauditlog_userid_idx" ON "yappchat"."authauditlog" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX "emailverificationtokens_tokenhash_key" ON "yappchat"."emailverificationtokens" USING btree ("tokenhash");--> statement-breakpoint
CREATE UNIQUE INDEX "orgmemberships_userid_orgid_key" ON "yappchat"."orgmemberships" USING btree ("userid","orgid");--> statement-breakpoint
CREATE INDEX "orgmemberships_orgid_idx" ON "yappchat"."orgmemberships" USING btree ("orgid");--> statement-breakpoint
CREATE UNIQUE INDEX "passwordresettokens_tokenhash_key" ON "yappchat"."passwordresettokens" USING btree ("tokenhash");--> statement-breakpoint
CREATE UNIQUE INDEX "refreshtokens_refreshtokenhash_key" ON "yappchat"."refreshtokens" USING btree ("refreshtokenhash");--> statement-breakpoint
CREATE INDEX "refreshtokens_familyid_idx" ON "yappchat"."refreshtokens" USING btree ("familyid");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_sessiontokenhash_key" ON "yappchat"."sessions" USING btree ("sessiontokenhash");--> statement-breakpoint
CREATE INDEX "sessions_userid_idx" ON "yappchat"."sessions" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "yappchat"."users" USING btree ("email");