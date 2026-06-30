CREATE TYPE "yappchat"."skillcategory" AS ENUM('productivity', 'communication', 'data', 'development', 'finance', 'media', 'integration', 'custom');--> statement-breakpoint
CREATE TYPE "yappchat"."skillcreatedby" AS ENUM('studio', 'pa', 'import');--> statement-breakpoint
CREATE TABLE "yappchat"."agenttemplates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"orgid" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"avatarurl" text DEFAULT '' NOT NULL,
	"systemprompt" text DEFAULT '' NOT NULL,
	"providerid" uuid,
	"async" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"maxruntimeseconds" integer DEFAULT 600 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."agenttemplateskills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agenttemplateid" uuid NOT NULL,
	"skillid" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."skills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"orgid" uuid NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"category" "yappchat"."skillcategory" DEFAULT 'custom' NOT NULL,
	"inputschema" jsonb NOT NULL,
	"handlerurl" text DEFAULT '' NOT NULL,
	"skilltoken" text NOT NULL,
	"async" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"createdby" "yappchat"."skillcreatedby" DEFAULT 'studio' NOT NULL,
	"createdbyuserid" uuid,
	"communityskillid" uuid,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."skilltestlogs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"skillid" uuid NOT NULL,
	"testedinput" jsonb NOT NULL,
	"httpstatus" integer,
	"responsebody" jsonb,
	"latencyms" integer,
	"success" boolean DEFAULT false NOT NULL,
	"testedat" timestamp with time zone DEFAULT now() NOT NULL,
	"testedby" uuid
);
--> statement-breakpoint
CREATE TABLE "yappchat"."skillversions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"skillid" uuid NOT NULL,
	"version" text NOT NULL,
	"previousversion" text,
	"changedfields" text[],
	"schemadiff" jsonb,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedby" uuid
);
--> statement-breakpoint
ALTER TABLE "yappchat"."agenttemplates" ADD CONSTRAINT "agenttemplates_orgid_orgs_id_fk" FOREIGN KEY ("orgid") REFERENCES "yappchat"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."agenttemplateskills" ADD CONSTRAINT "agenttemplateskills_agenttemplateid_agenttemplates_id_fk" FOREIGN KEY ("agenttemplateid") REFERENCES "yappchat"."agenttemplates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."agenttemplateskills" ADD CONSTRAINT "agenttemplateskills_skillid_skills_id_fk" FOREIGN KEY ("skillid") REFERENCES "yappchat"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skills" ADD CONSTRAINT "skills_orgid_orgs_id_fk" FOREIGN KEY ("orgid") REFERENCES "yappchat"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skills" ADD CONSTRAINT "skills_createdbyuserid_users_id_fk" FOREIGN KEY ("createdbyuserid") REFERENCES "yappchat"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skilltestlogs" ADD CONSTRAINT "skilltestlogs_skillid_skills_id_fk" FOREIGN KEY ("skillid") REFERENCES "yappchat"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skilltestlogs" ADD CONSTRAINT "skilltestlogs_testedby_users_id_fk" FOREIGN KEY ("testedby") REFERENCES "yappchat"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skillversions" ADD CONSTRAINT "skillversions_skillid_skills_id_fk" FOREIGN KEY ("skillid") REFERENCES "yappchat"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."skillversions" ADD CONSTRAINT "skillversions_updatedby_users_id_fk" FOREIGN KEY ("updatedby") REFERENCES "yappchat"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agenttemplates_orgid_name_key" ON "yappchat"."agenttemplates" USING btree ("orgid","name");--> statement-breakpoint
CREATE INDEX "agenttemplates_orgid_idx" ON "yappchat"."agenttemplates" USING btree ("orgid");--> statement-breakpoint
CREATE UNIQUE INDEX "agenttemplateskills_template_skill_key" ON "yappchat"."agenttemplateskills" USING btree ("agenttemplateid","skillid");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_orgid_name_key" ON "yappchat"."skills" USING btree ("orgid","name");--> statement-breakpoint
CREATE INDEX "skills_orgid_idx" ON "yappchat"."skills" USING btree ("orgid");--> statement-breakpoint
CREATE INDEX "skilltestlogs_skillid_idx" ON "yappchat"."skilltestlogs" USING btree ("skillid");--> statement-breakpoint
CREATE INDEX "skillversions_skillid_idx" ON "yappchat"."skillversions" USING btree ("skillid");