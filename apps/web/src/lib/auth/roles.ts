import { eq, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import { writeAudit } from "./audit";
import { sendEmail } from "./mailer";
import { countSystemAdmins } from "./service";
import type { SystemFlag } from "./session";

/**
 * Spec 011 T005 — system flags + bootstrap admin.
 * Three independent booleans on `users`, orthogonal to per-org role.
 */

export type SystemFlags = Partial<Record<SystemFlag, boolean>>;

/** Grant/revoke system flags on a target user (caller must be issystemadmin). */
export async function setSystemRoles(
  targetUserid: string,
  flags: SystemFlags,
  actorId: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const update: SystemFlags = {};
  if (typeof flags.issystemadmin === "boolean") update.issystemadmin = flags.issystemadmin;
  if (typeof flags.isbillingadmin === "boolean") update.isbillingadmin = flags.isbillingadmin;
  if (typeof flags.issupport === "boolean") update.issupport = flags.issupport;
  if (Object.keys(update).length === 0) return;

  await db.update(users).set({ ...update, updatedat: new Date() }).where(eq(users.id, targetUserid));
  await writeAudit({
    eventtype: "role_grant",
    userid: targetUserid,
    payload: { flags: update, by: actorId },
  });
}

export type SystemRoleUser = {
  id: string;
  email: string;
  displayname: string;
  issystemadmin: boolean;
  isbillingadmin: boolean;
  issupport: boolean;
};

/** List users with any system flag set (visible to issystemadmin / issupport). */
export async function listSystemRoleUsers(): Promise<SystemRoleUser[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      email: users.email,
      displayname: users.displayname,
      issystemadmin: users.issystemadmin,
      isbillingadmin: users.isbillingadmin,
      issupport: users.issupport,
    })
    .from(users)
    .where(
      or(
        eq(users.issystemadmin, true),
        eq(users.isbillingadmin, true),
        eq(users.issupport, true),
      ),
    );
}

/**
 * Idempotent first-admin bootstrap. If BOOTSTRAP_ADMIN_EMAIL is set and there is
 * no system admin yet, grant issystemadmin + isbillingadmin to that email
 * (updating an existing row or inserting a placeholder one).
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const db = getDb();
  if (!db) return;

  if ((await countSystemAdmins()) > 0) return; // already bootstrapped — no-op

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({ issystemadmin: true, isbillingadmin: true, updatedat: new Date() })
      .where(eq(users.id, existing.id));
  } else {
    userId = uuidv7();
    await db.insert(users).values({
      id: userId,
      email,
      displayname: "System Admin",
      issystemadmin: true,
      isbillingadmin: true,
    });
  }

  await writeAudit({ eventtype: "role_grant", userid: userId, payload: { reason: "bootstrap" } });
  // Cold-start coverage: email + (future) PA notification.
  await sendEmail({
    to: email,
    subject: "You are now a YappChatt system admin",
    body: "Your account has been granted system administrator access on this deployment.",
  });
  console.info(`[auth] bootstrap: granted system admin to ${email}`);
}
