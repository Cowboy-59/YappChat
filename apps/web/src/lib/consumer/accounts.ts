import { isUniqueViolation } from "../db/errors";
import type { ConsumerDeps } from "./deps";
import { normalizeEmail } from "./validate";

/**
 * SPEC-093 FR-002 — create or link a YappChatt account by email (C1.1).
 *
 * Reuses provisionOrLookupUserByEmail: an existing account is returned unchanged
 * (`created: false`, no email); a new one is created pre-verified and gets ONE
 * welcome email whose link sets the password through the existing reset flow
 * (a passwordresettokens row + /reset?token=..., consumed by consumePasswordReset).
 * The welcome link lives longer than a self-service reset because the person may
 * not read the email for days.
 */

// [SCOPE 093 / T002] BEGIN — Welcome link lifetime
export const WELCOME_LINK_TTL_MS = 7 * 24 * 3_600_000; // 7 days
// [SCOPE 093 / T002] END

// [SCOPE 093 / T002] BEGIN — createOrLinkAccount
export async function createOrLinkAccount(
  deps: ConsumerDeps,
  input: { email: unknown; displayName?: unknown },
): Promise<{ userid: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  const displayName =
    typeof input.displayName === "string" && input.displayName.trim() ? input.displayName.trim().slice(0, 200) : null;

  let result: { userid: string; created: boolean };
  try {
    result = await deps.provisionUser({ email, displayName });
  } catch (err) {
    // Two first calls for the same email raced: the loser hits users_email_key.
    // The winner created the account (and sends the only welcome email); this call
    // links to it.
    if (!isUniqueViolation(err)) throw err;
    result = await deps.provisionUser({ email, displayName });
    result = { userid: result.userid, created: false };
  }

  if (result.created) {
    await sendWelcomeEmail(deps, result.userid, email);
  }
  return result;
}
// [SCOPE 093 / T002] END

// [SCOPE 093 / T002] BEGIN — sendWelcomeEmail
async function sendWelcomeEmail(deps: ConsumerDeps, userid: string, email: string): Promise<void> {
  const { token, tokenhash } = deps.newToken();
  await deps.store.run((tx) =>
    tx.insertPasswordResetToken({
      userid,
      tokenhash,
      expiresat: new Date(deps.now().getTime() + WELCOME_LINK_TTL_MS),
    }),
  );
  await deps.sendEmail({
    to: email,
    subject: "Your company's YappChatt account is ready",
    body:
      "Your company set up a YappChatt account for its wxKanban team chat with this email address. " +
      "Use the link below to choose a password. It expires in 7 days; after that, use \"Forgot password\" on the sign-in page.",
    actionUrl: `${deps.siteUrl()}/reset?token=${token}`,
  });
}
// [SCOPE 093 / T002] END

// [SCOPE 093 / T009] BEGIN — lookupAccount
/**
 * C1.0 (Amendment A) — read-only lookup by email, so wxKanban can show an ADMIN which
 * account its Create button would link before they confirm (SCOPE-144 decision D5).
 * Creates nothing and sends nothing.
 */
export async function lookupAccount(
  deps: ConsumerDeps,
  emailInput: unknown,
): Promise<{ exists: boolean; userid: string | null; displayName: string | null }> {
  const email = normalizeEmail(emailInput);
  const user = await deps.store.run((tx) => tx.findUserByEmail(email));
  return user
    ? { exists: true, userid: user.id, displayName: user.displayname }
    : { exists: false, userid: null, displayName: null };
}
// [SCOPE 093 / T009] END
