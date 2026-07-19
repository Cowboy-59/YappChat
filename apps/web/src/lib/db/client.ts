import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as landingSchema from "./schema";
import * as authSchema from "./auth-schema";
import * as studioSchema from "./studio-schema";
import * as paSchema from "./pa-schema";
import * as engineSchema from "./engine-schema";
import * as wsSchema from "./ws-schema";
import * as contactsSchema from "./contacts-schema";
import * as groupingsSchema from "./groupings-schema";
import * as pushSchema from "./push-schema";

const schema = {
  ...landingSchema,
  ...authSchema,
  ...studioSchema,
  ...paSchema,
  ...engineSchema,
  ...wsSchema,
  ...contactsSchema,
  ...groupingsSchema,
  ...pushSchema,
};

/**
 * Lazy, optional Postgres connection.
 *
 * The landing page must render even with no database configured (foundation
 * phase: spec 011/013 and a live DB are not wired yet). When `DATABASE_URL` is
 * absent, `getDb()` returns null and the service layer falls back to seed
 * defaults. This keeps the page statically buildable without a DB.
 */
type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null | undefined;

export function getDb(): Db | null {
  if (cached !== undefined) return cached;

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    cached = null;
    return cached;
  }

  // Normalise the URL: honour sslmode=require, drop non-libpq params (e.g.
  // Prisma's ?schema=) that postgres-js doesn't understand. Tables are
  // schema-qualified via ycSchema, so no search_path is needed at runtime.
  const url = new URL(raw);
  const ssl = url.searchParams.get("sslmode") === "require" ? "require" : undefined;
  url.search = "";

  // prepare:false is required for Supabase's transaction pooler (pgBouncer).
  const client = postgres(url.toString(), { max: 5, prepare: false, ssl });
  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
