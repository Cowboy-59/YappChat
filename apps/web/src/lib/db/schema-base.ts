import { pgSchema } from "drizzle-orm/pg-core";

/**
 * All YappChatt tables live in a dedicated Postgres schema (per the configured
 * DATABASE_URL `?schema=yappchat`), keeping them isolated from `public`.
 * Drizzle emits fully-qualified names, so no runtime search_path is required.
 */
export const ycSchema = pgSchema("yappchat");
