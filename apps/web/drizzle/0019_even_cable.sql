CREATE TABLE "yappchat"."agentapitokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"label" text,
	"tokenhash" text NOT NULL,
	"last6" text NOT NULL,
	"createdby" uuid,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "yappchat"."devicesessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"deviceid" uuid NOT NULL,
	"sessionid" uuid NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedat" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "yappchat"."sessions" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "yappchat"."sessions" ADD COLUMN "useragent" text;--> statement-breakpoint
ALTER TABLE "yappchat"."agentapitokens" ADD CONSTRAINT "agentapitokens_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."devicesessions" ADD CONSTRAINT "devicesessions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."devicesessions" ADD CONSTRAINT "devicesessions_sessionid_sessions_id_fk" FOREIGN KEY ("sessionid") REFERENCES "yappchat"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agentapitokens_tokenhash_key" ON "yappchat"."agentapitokens" USING btree ("tokenhash");--> statement-breakpoint
CREATE INDEX "agentapitokens_userid_idx" ON "yappchat"."agentapitokens" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX "devicesessions_userid_deviceid_sessionid_key" ON "yappchat"."devicesessions" USING btree ("userid","deviceid","sessionid");--> statement-breakpoint
CREATE INDEX "devicesessions_userid_idx" ON "yappchat"."devicesessions" USING btree ("userid");