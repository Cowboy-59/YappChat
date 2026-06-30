// Non-destructive connectivity probe for the configured DATABASE_URL.
// Reports current database/user/schema and whether the target schema exists.
import { readFileSync } from "node:fs";
import postgres from "postgres";

// Minimal .env.local loader (no dotenv dep needed here).
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const u = new URL(raw);
const targetSchema = u.searchParams.get("schema") ?? process.env.DB_SCHEMA ?? "public";
const ssl = u.searchParams.get("sslmode") === "require" ? "require" : undefined;
// Strip non-libpq params before handing to postgres-js.
u.search = "";

console.log("host:", u.hostname, "port:", u.port, "db(path):", u.pathname.slice(1));
console.log("target schema:", targetSchema, "ssl:", ssl ?? "(none)");

const sql = postgres(u.toString(), { ssl, prepare: false, max: 1, idle_timeout: 5 });

try {
  const [info] = await sql`select current_database() as db, current_user as usr, version() as ver`;
  console.log("OK connected ->", info.db, "as", info.usr);
  console.log("version:", String(info.ver).split(" ").slice(0, 2).join(" "));

  const schemas = await sql`select schema_name from information_schema.schemata order by 1`;
  console.log("schemas:", schemas.map((s) => s.schema_name).join(", "));

  const exists = schemas.some((s) => s.schema_name === targetSchema);
  console.log(`target schema "${targetSchema}" exists:`, exists);

  const [{ n }] = await sql`select count(*)::int as n from information_schema.tables where table_schema = ${targetSchema}`;
  console.log(`tables in "${targetSchema}":`, n);
  process.exit(0);
} catch (err) {
  console.error("CONNECT FAILED:", err.message);
  process.exit(2);
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
