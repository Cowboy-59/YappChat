CREATE TYPE "yappchat"."spaceaisourcekind" AS ENUM('website', 'document', 'history');--> statement-breakpoint
CREATE TYPE "yappchat"."spaceaisourcestatus" AS ENUM('pending', 'indexing', 'ready', 'error');--> statement-breakpoint
CREATE TABLE "yappchat"."spaceaichunks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spaceid" uuid NOT NULL,
	"sourceid" uuid NOT NULL,
	"content" text NOT NULL,
	"anchor" text DEFAULT '' NOT NULL,
	"tokens" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."spaceaiconfig" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spaceid" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"model" text DEFAULT 'claude-opus-4-8' NOT NULL,
	"autoanswer" boolean DEFAULT true NOT NULL,
	"includehistory" boolean DEFAULT false NOT NULL,
	"lastindexedat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yappchat"."spaceaisources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spaceid" uuid NOT NULL,
	"kind" "yappchat"."spaceaisourcekind" NOT NULL,
	"url" text,
	"storagekey" text,
	"title" text DEFAULT '' NOT NULL,
	"status" "yappchat"."spaceaisourcestatus" DEFAULT 'pending' NOT NULL,
	"error" text,
	"pagecount" integer,
	"crawledat" timestamp with time zone,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "yappchat"."spaceaichunks" ADD CONSTRAINT "spaceaichunks_spaceid_spaces_id_fk" FOREIGN KEY ("spaceid") REFERENCES "yappchat"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."spaceaichunks" ADD CONSTRAINT "spaceaichunks_sourceid_spaceaisources_id_fk" FOREIGN KEY ("sourceid") REFERENCES "yappchat"."spaceaisources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."spaceaiconfig" ADD CONSTRAINT "spaceaiconfig_spaceid_spaces_id_fk" FOREIGN KEY ("spaceid") REFERENCES "yappchat"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yappchat"."spaceaisources" ADD CONSTRAINT "spaceaisources_spaceid_spaces_id_fk" FOREIGN KEY ("spaceid") REFERENCES "yappchat"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaceaichunks_spaceid_idx" ON "yappchat"."spaceaichunks" USING btree ("spaceid");--> statement-breakpoint
CREATE UNIQUE INDEX "spaceaiconfig_spaceid_key" ON "yappchat"."spaceaiconfig" USING btree ("spaceid");--> statement-breakpoint
CREATE INDEX "spaceaisources_spaceid_idx" ON "yappchat"."spaceaisources" USING btree ("spaceid");--> statement-breakpoint
--> FR-019 retrieval: GIN full-text index over chunk content (hand-added; drizzle-kit can't express expression indexes).
CREATE INDEX "spaceaichunks_content_fts_idx" ON "yappchat"."spaceaichunks" USING gin (to_tsvector('english', "content"));