// Applies generated Drizzle SQL migrations against the configured DATABASE_URL.
// Uses postgres-js directly (ssl + prepare:false) so it works over Supabase's
// transaction pooler, where `drizzle-kit push` is unreliable. Creates the target
// schema first and records applied files in yappchat.__migrations (idempotent).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

for (const line of readFileSync(join(appRoot, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const raw = process.env.DATABASE_URL;
if (!raw) { console.error("No DATABASE_URL"); process.exit(1); }

const u = new URL(raw);
const schema = u.searchParams.get("schema") ?? process.env.DB_SCHEMA ?? "yappchat";
const ssl = u.searchParams.get("sslmode") === "require" ? "require" : undefined;
u.search = "";

const sql = postgres(u.toString(), { ssl, prepare: false, max: 1 });

try {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS "${schema}"."__migrations" (name text primary key, appliedat timestamptz not null default now())`,
  );

  const dir = join(appRoot, "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const [done] = await sql`select 1 from ${sql(schema)}.__migrations where name = ${file}`;
    if (done) { console.log(`skip  ${file} (already applied)`); continue; }

    const content = readFileSync(join(dir, file), "utf8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`apply ${file} (${statements.length} statements)`);
    await sql.begin(async (tx) => {
      for (const stmt of statements) await tx.unsafe(stmt);
      await tx`insert into ${sql(schema)}.__migrations (name) values (${file})`;
    });
  }
  console.log("migrations complete.");
  process.exit(0);
} catch (err) {
  console.error("MIGRATION FAILED:", err.message);
  process.exit(2);
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
