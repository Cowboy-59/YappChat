import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import {
  devicesessions,
  emailverificationtokens,
  magiclinktokens,
  orgmemberships,
  orgs,
  passwordresettokens,
  refreshtokens,
  sessions,
  ssoidentities,
  users,
} from "../db/auth-schema";
import { getSiteUrl } from "../site";
import { writeAudit } from "./audit";
import {
  EMAIL_VERIFY_TTL_MS,
  MAGIC_LINK_TTL_MS,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_TTL_MS,
  REFRESH_GRACE_MS,
  REFRESH_TTL_MS,
  SESSION_TTL_MS,
} from "./constants";
import {
  clearAuthCookies,
  readRefreshCookie,
  readSessionCookie,
  setAuthCookies,
} from "./cookies";
import { anonymizeIp, generateToken, hashPassword, hashToken, verifyPassword } from "./crypto";
import { sendEmail } from "./mailer";
import { onFamilyRevoke, onSignedOut } from "./events";
import { getActiveOrg, type OrgSummary, type SessionUser } from "./session";

/** Typed auth error mapped to HTTP by the route handlers. */
export class AuthError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
    this.name = "AuthError";
  }
}

type Plan = "individual" | "corporate";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayname: row.displayname,
    kind: row.kind,
    issystemadmin: row.issystemadmin,
    isbillingadmin: row.isbillingadmin,
    issupport: row.issupport,
    emailverified: row.emailverifiedat != null,
    bio: row.bio,
    avatarurl: row.avatarurl,
    preferredlanguage: row.preferredlanguage,
  };
}

/** Request-scoped device context for the session row (anonymised IP + UA). */
async function sessionContext(): Promise<{ ip: string | null; useragent: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const rawIp = fwd ? fwd.split(",")[0]?.trim() : h.get("x-real-ip");
    return { ip: anonymizeIp(rawIp), useragent: h.get("user-agent") };
  } catch {
    return { ip: null, useragent: null };
  }
}

/** Create a session + refresh token (new family unless continuing one), set cookies. */
async function issueSession(
  userid: string,
  opts?: { familyid?: string; deviceid?: string | null },
): Promise<string> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const sessionToken = generateToken();
  const refreshToken = generateToken();
  const sessionId = uuidv7();
  const familyid = opts?.familyid ?? uuidv7();
  const deviceid = opts?.deviceid ?? null;
  const now = Date.now();
  const { ip, useragent } = await sessionContext();

  await db.insert(sessions).values({
    id: sessionId,
    userid,
    sessiontokenhash: hashToken(sessionToken),
    deviceid,
    ip,
    useragent,
    expiresat: new Date(now + SESSION_TTL_MS),
  });
  await db.insert(refreshtokens).values({
    id: uuidv7(),
    userid,
    refreshtokenhash: hashToken(refreshToken),
    familyid,
    sessionid: sessionId,
    expiresat: new Date(now + REFRESH_TTL_MS),
  });
  // Cross-spec device registry (T006): only for paired devices (mobile/desktop).
  if (deviceid) {
    await db
      .insert(devicesessions)
      .values({ id: uuidv7(), userid, deviceid, sessionid: sessionId })
      .onConflictDoNothing();
  }

  await setAuthCookies(sessionToken, refreshToken);
  return sessionId;
}

/** Establish a logged-in session for a user id (used by SSO sign-in). */
export async function issueSessionForUser(userid: string): Promise<void> {
  await issueSession(userid);
}

/**
 * SSO sign-in (spec 011 T007, FR-017). Resolve the user for a provider identity:
 *  1) known (provider, subject) → that user (sign in);
 *  2) else an account already exists for the email → throw 409. SOC 2: we NEVER
 *     auto-link by email — linking is an explicit, authenticated action (see
 *     linkSsoIdentity). This prevents account takeover via an attacker-controlled
 *     provider account that asserts a victim's email address.
 *  3) else auto-provision a brand-new account (no password) + personal org.
 * Returns the user id; the caller issues the session.
 */
export async function linkOrProvisionSso(input: {
  provider: string;
  subject: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  const email = normalizeEmail(input.email);

  const [ident] = await db
    .select({ userid: ssoidentities.userid })
    .from(ssoidentities)
    .where(and(eq(ssoidentities.provider, input.provider), eq(ssoidentities.subject, input.subject)))
    .limit(1);
  if (ident) return ident.userid;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    // SOC 2: an account already exists for this email — do NOT auto-link. The
    // user signs in with their existing method, then links this provider from
    // settings (linkSsoIdentity). Surfaced to the UI as `sso_account_exists`.
    throw new AuthError("sso_account_exists", 409);
  }

  const userId = uuidv7();
  const orgId = uuidv7();
  const displayname = input.name?.trim() || email.split("@")[0] || "New user";
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: userId, email, displayname, plan: "individual", emailverifiedat: new Date() });
    await tx.insert(orgs).values({ id: orgId, name: `${displayname}'s Workspace`, plantype: "individual", seatlimit: 1 });
    await tx.insert(orgmemberships).values({ id: uuidv7(), userid: userId, orgid: orgId, role: "owner" });
    await tx.insert(ssoidentities).values({ id: uuidv7(), userid: userId, provider: input.provider, subject: input.subject, email });
  });
  await writeAudit({ eventtype: "signup", userid: userId, payload: { via: "sso", provider: input.provider } });
  return userId;
}

/**
 * Explicit account linking (spec 011 T007, FR-018). The CURRENTLY signed-in user
 * attaches an external provider identity to their own account. Idempotent if the
 * identity is already theirs; 409 if it belongs to a different user.
 */
export async function linkSsoIdentity(
  userid: string,
  input: { provider: string; subject: string; email: string },
): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const [ident] = await db
    .select({ userid: ssoidentities.userid })
    .from(ssoidentities)
    .where(and(eq(ssoidentities.provider, input.provider), eq(ssoidentities.subject, input.subject)))
    .limit(1);
  if (ident) {
    if (ident.userid === userid) return; // already linked to me — no-op
    throw new AuthError("sso_identity_taken", 409);
  }

  await db.insert(ssoidentities).values({
    id: uuidv7(),
    userid,
    provider: input.provider,
    subject: input.subject,
    email: normalizeEmail(input.email),
  });
  await writeAudit({ eventtype: "oauth_link", userid, payload: { provider: input.provider } });
}

export type LinkedIdentity = { id: string; provider: string; email: string | null; createdat: string };

/** The caller's linked SSO identities + whether they also have a password set. */
export async function listSsoIdentities(
  userid: string,
): Promise<{ identities: LinkedIdentity[]; hasPassword: boolean }> {
  const db = getDb();
  if (!db) return { identities: [], hasPassword: false };
  const rows = await db
    .select({
      id: ssoidentities.id,
      provider: ssoidentities.provider,
      email: ssoidentities.email,
      createdat: ssoidentities.createdat,
    })
    .from(ssoidentities)
    .where(eq(ssoidentities.userid, userid))
    .orderBy(ssoidentities.createdat);
  const [u] = await db.select({ passwordhash: users.passwordhash }).from(users).where(eq(users.id, userid)).limit(1);
  return {
    identities: rows.map((r) => ({ ...r, createdat: r.createdat.toISOString() })),
    hasPassword: Boolean(u?.passwordhash),
  };
}

/**
 * Unlink an SSO identity (FR-018). Refuses (422) if it would leave the user with
 * NO sign-in method — no password AND no other linked identity — so a user can
 * never lock themselves out of their own account.
 */
export async function unlinkSsoIdentity(userid: string, identityId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const [ident] = await db
    .select({ id: ssoidentities.id, provider: ssoidentities.provider })
    .from(ssoidentities)
    .where(and(eq(ssoidentities.id, identityId), eq(ssoidentities.userid, userid)))
    .limit(1);
  if (!ident) throw new AuthError("identity_not_found", 404);

  const [u] = await db.select({ passwordhash: users.passwordhash }).from(users).where(eq(users.id, userid)).limit(1);
  const [others] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ssoidentities)
    .where(and(eq(ssoidentities.userid, userid), ne(ssoidentities.id, identityId)));
  if (!u?.passwordhash && (others?.n ?? 0) === 0) {
    throw new AuthError("last_sign_in_method", 422);
  }

  await db.delete(ssoidentities).where(eq(ssoidentities.id, identityId));
  await writeAudit({ eventtype: "oauth_unlink", userid, payload: { provider: ident.provider } });
}

/**
 * Revoke a single session by id + its refresh-token rotation family (the whole
 * device's chain). Authoritative server-side enforcement for session/force
 * revoke (T006); the WS `auth.force_signout` event just makes the drop instant.
 */
export async function revokeSessionById(sessionid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [rt] = await db
    .select({ familyid: refreshtokens.familyid })
    .from(refreshtokens)
    .where(eq(refreshtokens.sessionid, sessionid))
    .limit(1);
  if (rt) await revokeFamily(rt.familyid);
  await db
    .update(sessions)
    .set({ revokedat: new Date() })
    .where(and(eq(sessions.id, sessionid), isNull(sessions.revokedat)));
  await db
    .update(devicesessions)
    .set({ revokedat: new Date() })
    .where(and(eq(devicesessions.sessionid, sessionid), isNull(devicesessions.revokedat)));
}

/** Revoke every session + refresh token in a rotation family (≤1 statement each). */
async function revokeFamily(familyid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const now = new Date();

  const sessionIds = await db
    .select({ id: refreshtokens.sessionid })
    .from(refreshtokens)
    .where(eq(refreshtokens.familyid, familyid));
  const ids = sessionIds.map((r) => r.id).filter((v): v is string => v != null);

  await db
    .update(refreshtokens)
    .set({ revokedat: now })
    .where(and(eq(refreshtokens.familyid, familyid), isNull(refreshtokens.revokedat)));
  if (ids.length > 0) {
    await db
      .update(sessions)
      .set({ revokedat: now })
      .where(and(inArray(sessions.id, ids), isNull(sessions.revokedat)));
  }
}

/**
 * Revoke every still-active session in a family EXCEPT `keepSessionId` (the new
 * rotation tip). Keeps exactly one live session per device after rotation so the
 * device-session list and force-signout targeting stay 1:1 with physical devices.
 * Refresh tokens are left intact — reuse-detection still relies on replacedbyid.
 */
async function revokeOtherFamilySessions(familyid: string, keepSessionId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const ids = (
    await db
      .select({ id: refreshtokens.sessionid })
      .from(refreshtokens)
      .where(eq(refreshtokens.familyid, familyid))
  )
    .map((r) => r.id)
    .filter((v): v is string => v != null && v !== keepSessionId);
  if (ids.length === 0) return;
  await db
    .update(sessions)
    .set({ revokedat: new Date() })
    .where(and(inArray(sessions.id, ids), isNull(sessions.revokedat)));
}

// ── Signup ────────────────────────────────────────────────────────────────

export type SignupInput = {
  email: string;
  password: string;
  displayname: string;
  plan: Plan;
  orgname?: string;
};

export async function signup(
  input: SignupInput,
  ctx: { ip?: string | null },
): Promise<{ user: SessionUser; org: OrgSummary }> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  if (input.plan !== "individual" && input.plan !== "corporate") {
    throw new AuthError("plan_required", 400);
  }
  if (input.plan === "corporate" && !input.orgname?.trim()) {
    throw new AuthError("orgname_required_for_corporate", 400);
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError("password_too_short", 400);
  }
  if (!input.displayname?.trim()) throw new AuthError("displayname_required", 400);

  const email = normalizeEmail(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AuthError("invalid_email", 400);
  }

  const passwordhash = await hashPassword(input.password);
  const userId = uuidv7();
  const orgId = uuidv7();
  const isCorporate = input.plan === "corporate";
  const orgName = isCorporate
    ? input.orgname!.trim()
    : `${input.displayname.trim()}'s Workspace`;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        displayname: input.displayname.trim(),
        passwordhash,
        plan: input.plan,
      });
      await tx.insert(orgs).values({
        id: orgId,
        name: orgName,
        plantype: input.plan,
        seatlimit: isCorporate ? null : 1,
      });
      await tx.insert(orgmemberships).values({
        id: uuidv7(),
        userid: userId,
        orgid: orgId,
        role: "owner",
      });
    });
  } catch (err) {
    // Unique violation on email -> generic 422 (no account enumeration).
    if (isUniqueViolation(err)) throw new AuthError("registration_failed", 422);
    throw err;
  }

  await issueSession(userId);
  await sendVerificationEmail(userId, email);
  await writeAudit({ eventtype: "signup", userid: userId, ip: ctx.ip, payload: { plan: input.plan } });

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const org: OrgSummary = { id: orgId, name: orgName, role: "owner", plantype: input.plan };
  return { user: toSessionUser(row), org };
}

// ── Login ─────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
  ctx: { ip?: string | null },
): Promise<{ user: SessionUser; org: OrgSummary | null }> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  // Constant-ish work whether or not the user exists; same error either way.
  const ok = row?.passwordhash
    ? await verifyPassword(row.passwordhash, password)
    : await verifyPassword(DUMMY_HASH, password);

  if (!row || !ok) throw new AuthError("invalid_credentials", 401);

  await issueSession(row.id);
  await writeAudit({ eventtype: "login", userid: row.id, ip: ctx.ip });

  const org = await getActiveOrg(row.id);
  return { user: toSessionUser(row), org };
}

// A precomputed argon2id hash so login does equivalent work for unknown emails.
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$YWJjZGVmZ2hpamtsbW5vcA$RdescudvDCM3xfHsTsyssNQ6lQ0o2qjWcSaY3Iczf0c";

// ── Logout ──────────────────────────────────────────────────────────────────

export async function logout(ctx: { ip?: string | null }): Promise<void> {
  const db = getDb();
  const token = await readSessionCookie();
  if (db && token) {
    const [sess] = await db
      .select({ id: sessions.id, userid: sessions.userid })
      .from(sessions)
      .where(eq(sessions.sessiontokenhash, hashToken(token)))
      .limit(1);
    if (sess) {
      const [rt] = await db
        .select({ familyid: refreshtokens.familyid })
        .from(refreshtokens)
        .where(eq(refreshtokens.sessionid, sess.id))
        .limit(1);
      if (rt) await revokeFamily(rt.familyid);
      await db.update(sessions).set({ revokedat: new Date() }).where(eq(sessions.id, sess.id));
      await writeAudit({ eventtype: "logout", userid: sess.userid, ip: ctx.ip });
      // Cross-spec: notify other tabs/devices (spec 003 WS). Stubbed.
      await onSignedOut(sess.userid);
    }
  }
  await clearAuthCookies();
}

// ── Refresh rotation (T004) ──────────────────────────────────────────────────

export async function refresh(ctx: { ip?: string | null }): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const token = await readRefreshCookie();
  if (!token) throw new AuthError("no_refresh_token", 401);

  const [rt] = await db
    .select()
    .from(refreshtokens)
    .where(eq(refreshtokens.refreshtokenhash, hashToken(token)))
    .limit(1);

  if (!rt || rt.revokedat) throw new AuthError("invalid_refresh_token", 401);
  if (rt.expiresat.getTime() < Date.now()) throw new AuthError("refresh_expired", 401);

  if (rt.replacedbyid) {
    // Already rotated. Within the grace window this is a benign retry race;
    // beyond it, it's token reuse -> revoke the whole family.
    const rotatedAt = rt.rotatedat?.getTime() ?? 0;
    if (Date.now() - rotatedAt > REFRESH_GRACE_MS) {
      await revokeFamily(rt.familyid);
      await writeAudit({
        eventtype: "family_revoke",
        userid: rt.userid,
        ip: ctx.ip,
        payload: { familyid: rt.familyid, reason: "refresh_reuse" },
      });
      // Cross-spec: WS sign-out + PA notification (specs 003/002). Stubbed.
      await onFamilyRevoke(rt.userid);
      await clearAuthCookies();
      throw new AuthError("token_reuse_detected", 401);
    }
    // Grace: issue a fresh rotation in the same family, then collapse the family
    // to that one live session (one session row per physical device).
    const graceSessionId = await issueSession(rt.userid, { familyid: rt.familyid });
    await revokeOtherFamilySessions(rt.familyid, graceSessionId);
    return;
  }

  // Normal rotation: new tokens in the same family; mark the old as replaced.
  const newRefreshId = uuidv7();
  const newSessionId = await issueSessionContinuingFamily(rt.userid, rt.familyid, newRefreshId);
  await db
    .update(refreshtokens)
    .set({ replacedbyid: newRefreshId, rotatedat: new Date() })
    .where(eq(refreshtokens.id, rt.id));
  // Keep one live session per device: revoke the prior session row(s) in this
  // family so the device-session list + force-signout target exactly one session.
  await revokeOtherFamilySessions(rt.familyid, newSessionId);
}

/** Like issueSession but with a caller-supplied refresh id (for replacedbyid linkage). */
async function issueSessionContinuingFamily(
  userid: string,
  familyid: string,
  refreshId: string,
): Promise<string> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const sessionToken = generateToken();
  const refreshToken = generateToken();
  const sessionId = uuidv7();
  const now = Date.now();
  const { ip, useragent } = await sessionContext();

  await db.insert(sessions).values({
    id: sessionId,
    userid,
    sessiontokenhash: hashToken(sessionToken),
    ip,
    useragent,
    expiresat: new Date(now + SESSION_TTL_MS),
  });
  await db.insert(refreshtokens).values({
    id: refreshId,
    userid,
    refreshtokenhash: hashToken(refreshToken),
    familyid,
    sessionid: sessionId,
    expiresat: new Date(now + REFRESH_TTL_MS),
  });
  await setAuthCookies(sessionToken, refreshToken);
  return sessionId;
}

// ── Password reset (T002) ────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const db = getDb();
  if (!db) return; // always 202 at the route; nothing to do without a DB

  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  if (!row) return; // no enumeration: route still returns 202

  const token = generateToken();
  await db.insert(passwordresettokens).values({
    id: uuidv7(),
    userid: row.id,
    tokenhash: hashToken(token),
    expiresat: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });
  await sendEmail({
    to: row.email,
    subject: "Reset your YappChatt password",
    body: "Use the link below to reset your password. It expires in 15 minutes.",
    actionUrl: `${getSiteUrl()}/reset?token=${token}`,
  });
}

export async function consumePasswordReset(
  token: string,
  newPassword: string,
  ctx: { ip?: string | null },
): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError("password_too_short", 400);
  }

  const [row] = await db
    .select()
    .from(passwordresettokens)
    .where(eq(passwordresettokens.tokenhash, hashToken(token)))
    .limit(1);

  if (!row || row.consumedat || row.expiresat.getTime() < Date.now()) {
    throw new AuthError("invalid_or_expired_token", 410);
  }

  const passwordhash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordhash, updatedat: new Date() }).where(eq(users.id, row.userid));
    await tx
      .update(passwordresettokens)
      .set({ consumedat: new Date() })
      .where(eq(passwordresettokens.id, row.id));
  });

  // Revoke ALL sessions + refresh families for the user after a password change.
  await db.update(sessions).set({ revokedat: new Date() }).where(and(eq(sessions.userid, row.userid), isNull(sessions.revokedat)));
  await db.update(refreshtokens).set({ revokedat: new Date() }).where(and(eq(refreshtokens.userid, row.userid), isNull(refreshtokens.revokedat)));
  await writeAudit({ eventtype: "password_reset", userid: row.userid, ip: ctx.ip });
}

// ── Email verification (T002) ────────────────────────────────────────────────

async function sendVerificationEmail(userid: string, email: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const token = generateToken();
  await db.insert(emailverificationtokens).values({
    id: uuidv7(),
    userid,
    tokenhash: hashToken(token),
    expiresat: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
  });
  await sendEmail({
    to: email,
    subject: "Verify your YappChatt email",
    body: "Confirm your email address using the link below.",
    actionUrl: `${getSiteUrl()}/api/auth/email-verify/${token}`,
  });
}

export async function requestEmailVerification(userid: string, email: string): Promise<void> {
  await sendVerificationEmail(userid, email);
}

export async function consumeEmailVerification(
  token: string,
  ctx: { ip?: string | null },
): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const [row] = await db
    .select()
    .from(emailverificationtokens)
    .where(eq(emailverificationtokens.tokenhash, hashToken(token)))
    .limit(1);

  if (!row || row.consumedat || row.expiresat.getTime() < Date.now()) {
    throw new AuthError("invalid_or_expired_token", 410);
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailverifiedat: new Date() }).where(eq(users.id, row.userid));
    await tx
      .update(emailverificationtokens)
      .set({ consumedat: new Date() })
      .where(eq(emailverificationtokens.id, row.id));
  });
  await writeAudit({ eventtype: "email_verify", userid: row.userid, ip: ctx.ip });
}

// ── Magic-link / email-OTP (T003) ────────────────────────────────────────────

/**
 * Request a magic link. ALWAYS succeeds silently (no account enumeration).
 * Stores the email so a brand-new address can be turned into an account on
 * consume (frictionless onboarding).
 */
export async function requestMagicLink(email: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const normalized = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) return;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  const token = generateToken();
  await db.insert(magiclinktokens).values({
    id: uuidv7(),
    userid: existing?.id ?? null,
    email: normalized,
    tokenhash: hashToken(token),
    expiresat: new Date(Date.now() + MAGIC_LINK_TTL_MS),
  });

  await sendEmail({
    to: normalized,
    subject: "Your YappChatt sign-in link",
    body: "Click the link below to sign in. It expires in 10 minutes and can be used once.",
    actionUrl: `${getSiteUrl()}/api/auth/login/magic/${token}`,
  });
}

/**
 * Consume a magic link: issues a session. If no account matches the token's
 * email, one is created (personal org + owner membership, email pre-verified).
 * Replayed/expired tokens are rejected (410).
 */
export async function consumeMagicLink(
  token: string,
  ctx: { ip?: string | null },
): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);

  const [row] = await db
    .select()
    .from(magiclinktokens)
    .where(eq(magiclinktokens.tokenhash, hashToken(token)))
    .limit(1);

  if (!row || row.consumedat || row.expiresat.getTime() < Date.now()) {
    throw new AuthError("invalid_or_expired_token", 410);
  }

  await db
    .update(magiclinktokens)
    .set({ consumedat: new Date() })
    .where(eq(magiclinktokens.id, row.id));

  let userId = row.userid;
  if (!userId) {
    // Frictionless signup-on-consume: create an individual account.
    userId = uuidv7();
    const orgId = uuidv7();
    const displayname = row.email.split("@")[0] || "New user";
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId!,
        email: row.email,
        displayname,
        plan: "individual",
        emailverifiedat: new Date(), // proven control of the inbox
      });
      await tx.insert(orgs).values({
        id: orgId,
        name: `${displayname}'s Workspace`,
        plantype: "individual",
        seatlimit: 1,
      });
      await tx.insert(orgmemberships).values({
        id: uuidv7(),
        userid: userId!,
        orgid: orgId,
        role: "owner",
      });
    });
  }

  await issueSession(userId);
  await writeAudit({ eventtype: "login", userid: userId, ip: ctx.ip, payload: { method: "magic_link" } });
}

// ── helpers ───────────────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  // Drizzle wraps the driver error: the Postgres code (23505) is on `cause`.
  const codeOf = (e: unknown): string | undefined =>
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  if (err && typeof err === "object" && "cause" in err) {
    if (codeOf((err as { cause?: unknown }).cause) === "23505") return true;
  }
  return codeOf(err) === "23505";
}

/** Count system admins — used by bootstrap. */
export async function countSystemAdmins(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.issystemadmin, true));
  return row?.n ?? 0;
}
