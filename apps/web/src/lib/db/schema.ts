import {
  boolean,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";
import type {
  Branding,
  Downloads,
  Feature,
  FaqItem,
  Plan,
  Security,
  Seo,
  Testimonial,
} from "../landing/config-schema";

/**
 * Spec 012 T004 — `landingpageconfig`.
 *
 * Follows project DB conventions (CLAUDE.md / projectrules.md):
 * lowercase names, no separators, UUID v7 `id`, single row per deployment
 * (UNIQUE on `deploymentid`). `updatedby` references spec 011 `users.id`;
 * the FK constraint is intentionally deferred until spec 011 ships (no users
 * table yet) — kept as a plain uuid column so data is forward-compatible.
 */
export const landingpageconfig = ycSchema.table(
  "landingpageconfig",
  {
    id: uuid("id").primaryKey(),
    deploymentid: text("deploymentid").notNull(),
    branding: jsonb("branding").$type<Branding>().notNull(),
    seo: jsonb("seo").$type<Seo>().notNull(),
    plans: jsonb("plans").$type<Plan[]>().notNull(),
    features: jsonb("features").$type<Feature[]>().notNull(),
    faq: jsonb("faq").$type<FaqItem[]>().notNull(),
    testimonials: jsonb("testimonials").$type<Testimonial[]>().notNull(),
    security: jsonb("security").$type<Security>().notNull(),
    downloads: jsonb("downloads").$type<Downloads>().notNull(),
    disabled: boolean("disabled").notNull().default(false),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
    // FK -> users.id (spec 011). Constraint added when spec 011 lands.
    updatedby: uuid("updatedby"),
  },
  (table) => [uniqueIndex("landingpageconfig_deploymentid_key").on(table.deploymentid)],
);

export type LandingPageConfigRow = typeof landingpageconfig.$inferSelect;
export type NewLandingPageConfigRow = typeof landingpageconfig.$inferInsert;
