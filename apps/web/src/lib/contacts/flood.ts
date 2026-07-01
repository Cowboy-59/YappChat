import { and, desc, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import { contactfreezes } from "../db/contacts-schema";
import { clearRateLimit, rateLimit } from "../auth/ratelimit";
import { writeAudit } from "../auth/audit";
import { sendEmail } from "../auth/mailer";
import { getSiteUrl } from "../site";
import { isUniqueViolation } from "../db/errors";
import { EngineError } from "../engine/errors";

/**
 * Contact-request flood guard (spec 018 delta §5). A rolling per-user rate trip
 * that, on exceeding the threshold, applies a DURABLE freeze blocking ONLY the
 * sending of new contact requests. The freeze never auto-expires — a sysadmin
 * must clear it (see the admin freeze surface). The in-memory rolling counter is
 * only the fast trip detector; the `contactfreezes` table is the authoritative,
 * restart-surviving guard (documented per-node limitation, mirrors the auth limiter).
 */

const LIMIT = Number(process.env.CONTACT_FLOOD_LIMIT ?? 20);
const WINDOW_MS = Number(process.env.CONTACT_FLOOD_WINDOW_MS ?? 60_000);
/** Digest throttle so trips can't be weaponised as a sysadmin mail-bomb (finding #28). */
const ADMIN_NOTIFY_COOLDOWN_MS = 5 * 60_000;

const floodKey = (userid: string) => `contactflood:${userid}`;
let lastAdminNotifyAt = 0;

/** Whether the user currently has an active (uncleared) contact-request freeze. */
export async function isContactRequestsFrozen(userid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: contactfreezes.id })
    .from(contactfreezes)
    .where(and(eq(contactfreezes.userid, userid), isNull(contactfreezes.clearedat)))
    .limit(1);
  return Boolean(row);
}

/**
 * The flood gate for a contact-request-sending action. Checks the freeze FIRST
 * (a frozen sender never further increments the window), then counts this attempt;
 * if it trips, applies the durable freeze + audit + digest notify. Throws
 * `contact_requests_frozen` (429) when the caller is (or has just become) frozen.
 */
export async function guardContactFloodOrThrow(userid: string): Promise<void> {
  if (await isContactRequestsFrozen(userid)) {
    throw new EngineError("contact_requests_frozen", 429, "You are suspended from sending contact requests. A system administrator must review this before it can be lifted.");
  }
  const res = rateLimit(floodKey(userid), LIMIT, WINDOW_MS);
  if (!res.allowed) {
    await applyFreeze(userid, LIMIT);
    throw new EngineError("contact_requests_frozen", 429, "You are suspended from sending contact requests. A system administrator must review this before it can be lifted.");
  }
}

async function applyFreeze(userid: string, observedCount: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  // Idempotent: a re-trip of an already-frozen user must not stack a second row.
  if (await isContactRequestsFrozen(userid)) return;
  try {
    await db.insert(contactfreezes).values({
      id: uuidv7(),
      userid,
      reason: "contact_flood",
      triggercount: observedCount,
      triggerlimit: LIMIT,
      windowms: WINDOW_MS,
    });
  } catch (err) {
    // Lost a race to the partial-unique index — already frozen, nothing to do.
    if (!isUniqueViolation(err)) throw err;
    return;
  }
  await writeAudit({
    eventtype: "contact_flood",
    userid,
    payload: { count: observedCount, limit: LIMIT, windowMs: WINDOW_MS, at: new Date().toISOString() },
  });
  await notifyAdmins(userid);
}

/** Email sysadmins, digest-throttled. The in-app surface is the durable source of truth. */
async function notifyAdmins(frozenUserId: string): Promise<void> {
  const now = Date.now();
  if (now - lastAdminNotifyAt < ADMIN_NOTIFY_COOLDOWN_MS) return;
  lastAdminNotifyAt = now;
  const db = getDb();
  if (!db) return;
  const admins = await db.select({ email: users.email }).from(users).where(eq(users.issystemadmin, true));
  const [fu] = await db
    .select({ email: users.email, displayname: users.displayname })
    .from(users)
    .where(eq(users.id, frozenUserId))
    .limit(1);
  const who = fu ? `${fu.displayname || fu.email} (${fu.email})` : frozenUserId;
  for (const a of admins) {
    await sendEmail({
      to: a.email,
      subject: "YappChat — contact-request flood freeze",
      body: `${who} was frozen for contact-request flooding (limit ${LIMIT} per ${Math.round(WINDOW_MS / 1000)}s). Other frozen users may also be pending review. Open the admin console to review and unfreeze.`,
      actionUrl: `${getSiteUrl()}/admin`,
    });
  }
}

export type ActiveFreeze = {
  id: string;
  userid: string;
  email: string;
  displayname: string;
  reason: string;
  triggercount: number;
  triggerlimit: number;
  windowms: number;
  createdat: Date;
};

/** List currently-active (uncleared) freezes for the sysadmin review surface. */
export async function listActiveFreezes(): Promise<ActiveFreeze[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: contactfreezes.id,
      userid: contactfreezes.userid,
      email: users.email,
      displayname: users.displayname,
      reason: contactfreezes.reason,
      triggercount: contactfreezes.triggercount,
      triggerlimit: contactfreezes.triggerlimit,
      windowms: contactfreezes.windowms,
      createdat: contactfreezes.createdat,
    })
    .from(contactfreezes)
    .innerJoin(users, eq(contactfreezes.userid, users.id))
    .where(isNull(contactfreezes.clearedat))
    .orderBy(desc(contactfreezes.createdat));
  return rows;
}

/** Sysadmin unfreeze: clear the active freeze, reset the stale window, audit. */
export async function unfreezeContactRequests(freezeId: string, actingAdminId: string): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(contactfreezes).where(eq(contactfreezes.id, freezeId)).limit(1);
  if (!row || row.clearedat) return { ok: false };
  await db
    .update(contactfreezes)
    .set({ clearedat: new Date(), clearedby: actingAdminId })
    .where(eq(contactfreezes.id, freezeId));
  // Drop the stale in-memory window so the user doesn't instantly re-trip.
  clearRateLimit(floodKey(row.userid));
  await writeAudit({
    eventtype: "contact_unfreeze",
    userid: row.userid,
    payload: { by: actingAdminId, freeze: freezeId },
  });
  return { ok: true };
}
