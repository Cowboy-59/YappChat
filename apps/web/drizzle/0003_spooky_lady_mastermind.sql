CREATE TYPE "yappchat"."aiprovidertype" AS ENUM('openai-compatible', 'anthropic', 'ollama', 'custom');--> statement-breakpoint
CREATE TYPE "yappchat"."assistantrole" AS ENUM('user', 'assistant', 'tool_result');--> statement-breakpoint
CREATE TABLE "yappchat"."aiproviders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid,
	"name" text NOT NULL,
	"type" "yappchat"."aiprovidertype" NOT NULL,
	"baseurl" text DEFAULT '' NOT NULL,
	"model" text NOT NULL,
	"apikey" text DEFAULT '' NOT NULL,
	"supportstooluse" boolean DEFAULT false NOT NULL,
	"supportsstreaming" boolean DEFAULT true NOT NULL,
	"isdefault" boolean DEFAULT false NOT NULL,
	"lastpingedat" timestamp with time zone,
	"lastpinglatencyms" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."assistantmessages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sessionid" uuid NOT NULL,
	"role" "yappchat"."assistantrole" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"toolcalls" jsonb,
	"prompttokens" integer,
	"completiontokens" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."assistantsessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"name" text NOT NULL,
	"providerid" uuid,
	"lastmessageat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."paconfigs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userid" uuid NOT NULL,
	"activeproviderid" uuid,
	"briefingtimeutc" text,
	"monitorintervalmin" integer DEFAULT 5 NOT NULL,
	"notificationprefs" jsonb,
	"bubbletimeoutms" integer DEFAULT 8000 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."aiproviders" ADD CONSTRAINT "aiproviders_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."assistantmessages" ADD CONSTRAINT "assistantmessages_sessionid_assistantsessions_id_fk" FOREIGN KEY ("sessionid") REFERENCES "yappchat"."assistantsessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."assistantsessions" ADD CONSTRAINT "assistantsessions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."assistantsessions" ADD CONSTRAINT "assistantsessions_providerid_aiproviders_id_fk" FOREIGN KEY ("providerid") REFERENCES "yappchat"."aiproviders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."paconfigs" ADD CONSTRAINT "paconfigs_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "yappchat"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."paconfigs" ADD CONSTRAINT "paconfigs_activeproviderid_aiproviders_id_fk" FOREIGN KEY ("activeproviderid") REFERENCES "yappchat"."aiproviders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aiproviders_userid_idx" ON "yappchat"."aiproviders" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX "aiproviders_one_default" ON "yappchat"."aiproviders" USING btree ("isdefault") WHERE "yappchat"."aiproviders"."isdefault" = true;--> statement-breakpoint
CREATE INDEX "assistantmessages_sessionid_idx" ON "yappchat"."assistantmessages" USING btree ("sessionid");--> statement-breakpoint
CREATE INDEX "assistantsessions_userid_idx" ON "yappchat"."assistantsessions" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX "paconfigs_userid_key" ON "yappchat"."paconfigs" USING btree ("userid");