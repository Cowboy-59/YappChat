import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeCallback, type SsoClaims, type SsoProvider } from "@/lib/auth/sso";
import {
  AuthError,
  issueSessionForUser,
  linkOrProvisionSso,
  linkSsoIdentity,
} from "@/lib/auth/service";
import { getSessionUser } from "@/lib/auth/session";
import { resolveReturnPath } from "@/lib/auth/return-url";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set(["google", "microsoft", "oidc"]);

/** GET /api/auth/sso/:provider/callback — exchange the code, then sign in / link. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = new URL(req.url).origin;
  const store = await cookies();

  const codeVerifier = store.get("yc_sso_v")?.value;
  const state = store.get("yc_sso_s")?.value;
  const returnTo = store.get("yc_sso_r")?.value ?? "/app";
  const startedProvider = store.get("yc_sso_p")?.value;
  const intent = store.get("yc_sso_i")?.value === "link" ? "link" : "signin";
  // One-shot: clear the transient cookies regardless of outcome.
  for (const n of ["yc_sso_v", "yc_sso_s", "yc_sso_r", "yc_sso_p", "yc_sso_i"]) {
    store.set(n, "", { path: "/api/auth/sso", maxAge: 0 });
  }

  if (!PROVIDERS.has(provider) || !codeVerifier || !state || startedProvider !== provider) {
    return NextResponse.redirect(new URL("/signin?sso_error=state", origin));
  }

  let claims: SsoClaims;
  try {
    claims = await completeCallback(provider as SsoProvider, new URL(req.url), { codeVerifier, state });
  } catch (err) {
    console.error(`[sso] callback failed (${provider}):`, (err as Error).message);
    return NextResponse.redirect(new URL("/signin?sso_error=failed", origin));
  }

  // Explicit linking (FR-018): attach the identity to the already-signed-in user.
  if (intent === "link") {
    const safeReturn = resolveReturnPath(returnTo, { isSystemStaff: false });
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.redirect(new URL(`/signin?return=${encodeURIComponent(safeReturn)}`, origin));
    }
    try {
      await linkSsoIdentity(user.id, { provider, subject: claims.sub, email: claims.email });
      return NextResponse.redirect(new URL(`${safeReturn}?linked=${provider}`, origin));
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "link_failed";
      return NextResponse.redirect(new URL(`${safeReturn}?link_error=${code}`, origin));
    }
  }

  // Sign-in / provision. SOC 2: linkOrProvisionSso throws 409 if an account
  // already exists for this email (no auto-link) — surface as account_exists.
  try {
    const userid = await linkOrProvisionSso({
      provider,
      subject: claims.sub,
      email: claims.email,
      name: claims.name,
    });
    await issueSessionForUser(userid);
    return NextResponse.redirect(new URL(resolveReturnPath(returnTo, { isSystemStaff: false }), origin));
  } catch (err) {
    if (err instanceof AuthError && err.code === "sso_account_exists") {
      return NextResponse.redirect(new URL("/signin?sso_error=account_exists", origin));
    }
    console.error(`[sso] sign-in failed (${provider}):`, (err as Error).message);
    return NextResponse.redirect(new URL("/signin?sso_error=failed", origin));
  }
}
