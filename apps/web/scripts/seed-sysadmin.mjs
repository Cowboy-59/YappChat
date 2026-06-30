// Provision (or promote) a system administrator account.
//
// Registers the account through the real signup flow (argon2 password hashing +
// individual org) when it doesn't exist yet, then sets the `issystemadmin` flag
// (spec 011 T005) directly on the row and marks the email verified.
//
// Credentials come from the environment so nothing secret is committed:
//   SYSADMIN_EMAIL=... SYSADMIN_PASSWORD=... [APP=http://localhost:3000] \
//     node scripts/seed-sysadmin.mjs
//
// Requires the app dev server running (for signup) + DATABASE_URL in .env.local.
import { readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const APP = process.env.APP ?? "http://localhost:3000";
const email = process.env.SYSADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SYSADMIN_PASSWORD;
if (!email || !password) {
  console.error("Set SYSADMIN_EMAIL and SYSADMIN_PASSWORD in the environment.");
  process.exit(1);
}

// 1) Register via the real signup endpoint (idempotent — tolerate email_taken).
const res = await fetch(`${APP}/api/auth/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, displayname: "System Admin", plan: "individual" }),
});
if (res.status === 201) {
  console.log(`signup: created ${email}`);
} else {
  const body = await res.json().catch(() => ({}));
  if (res.status === 409 || body.error === "email_taken") {
    console.log(`signup: ${email} already exists — promoting existing account`);
  } else {
    console.error(`signup failed (${res.status}):`, body);
    process.exit(1);
  }
}

// 2) Flip the system-admin flag on the row + mark the email verified.
const u = new URL(process.env.DATABASE_URL);
const schema = u.searchParams.get("schema") ?? process.env.DB_SCHEMA ?? "public";
const ssl = u.searchParams.get("sslmode") === "require" ? "require" : undefined;
u.search = "";
const sql = postgres(u.toString(), { ssl, prepare: false, max: 1, idle_timeout: 5 });

try {
  const rows = await sql`
    update ${sql(schema)}.users
       set issystemadmin = true,
           emailverifiedat = coalesce(emailverifiedat, now()),
           updatedat = now()
     where email = ${email}
    returning id, email, displayname, issystemadmin, isbillingadmin, issupport, emailverifiedat`;
  if (rows.length === 0) {
    console.error(`No users row for ${email} — signup did not persist?`);
    process.exit(1);
  }
  console.log("promoted:", rows[0]);
  console.log("DONE — system admin provisioned.");
} finally {
  await sql.end({ timeout: 5 });
}
