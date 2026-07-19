import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeCallback, type SsoClaims, type SsoProvider } from "@/lib/auth/sso";
import {
  AuthError,
  issueSessionForUser,
  issueSessionForUserWithToken,
  linkOrProvisionSso,
  linkSsoIdentity,
} from "@/lib/auth/service";
import { getSessionUser } from "@/lib/auth/session";
import { autoAcceptContactInvitesForUser } from "@/lib/contacts/service";
import { resolveReturnPath } from "@/lib/auth/return-url";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set(["google", "microsoft", "oidc"]);

/** Native app deep-link the mobile SSO round-trip returns to (spec 008). */
const MOBILE_CALLBACK = "yappchat://auth";
function mobileRedirect(params: Record<string, string>): string {
  const u = new URL(MOBILE_CALLBACK);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** GET /api/auth/sso/:provider/callback — exchange the code, then sign in / link. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  // Behind the ALB, new URL(req.url) resolves to the container's own
  // localhost:3000, not the public host. Use the configured public base
  // (SITE_URL / NEXT_PUBLIC_SITE_URL) so (a) our redirects target the real site
  // and (b) the OIDC token-exchange redirect_uri matches the one sent at
  // initiation — otherwise the provider returns redirect_uri_mismatch.
  const base = getSiteUrl();
  const callbackUrl = new URL(`/api/auth/sso/${provider}/callback${new URL(req.url).search}`, base);
  const store = await cookies();

  const codeVerifier = store.get("yc_sso_v")?.value;
  const state = store.get("yc_sso_s")?.value;
  const returnTo = store.get("yc_sso_r")?.value ?? "/app";
  const startedProvider = store.get("yc_sso_p")?.value;
  const intent = store.get("yc_sso_i")?.value === "link" ? "link" : "signin";
  // Mobile (spec 008): return the result to the app via the yappchat://auth deep link.
  const mobile = store.get("yc_sso_m")?.value === "1";
  // One-shot: clear the transient cookies regardless of outcome.
  for (const n of ["yc_sso_v", "yc_sso_s", "yc_sso_r", "yc_sso_p", "yc_sso_i", "yc_sso_m"]) {
    store.set(n, "", { path: "/api/auth/sso", maxAge: 0 });
  }

  if (!PROVIDERS.has(provider) || !codeVerifier || !state || startedProvider !== provider) {
    return NextResponse.redirect(
      mobile ? mobileRedirect({ error: "state" }) : new URL("/signin?sso_error=state", base),
    );
  }

  let claims: SsoClaims;
  try {
    claims = await completeCallback(provider as SsoProvider, callbackUrl, { codeVerifier, state });
  } catch (err) {
    console.error(`[sso] callback failed (${provider}):`, (err as Error).message);
    return NextResponse.redirect(
      mobile ? mobileRedirect({ error: "failed" }) : new URL("/signin?sso_error=failed", base),
    );
  }

  // Explicit linking (FR-018): attach the identity to the already-signed-in user.
  if (intent === "link") {
    const safeReturn = resolveReturnPath(returnTo, { isSystemStaff: false });
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.redirect(new URL(`/signin?return=${encodeURIComponent(safeReturn)}`, base));
    }
    try {
      await linkSsoIdentity(user.id, { provider, subject: claims.sub, email: claims.email });
      return NextResponse.redirect(new URL(`${safeReturn}?linked=${provider}`, base));
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "link_failed";
      return NextResponse.redirect(new URL(`${safeReturn}?link_error=${code}`, base));
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
    // FR-024 — SSO accounts are verified-on-provision: auto-accept any pending
    // invites addressed to this email (and notify the inviters). Best-effort.
    if (mobile) {
      // Native flow: mint a bearer token and hand it back to the app via the deep
      // link (the cookie is set too, but the app authenticates with the token).
      const token = await issueSessionForUserWithToken(userid);
      await autoAcceptContactInvitesForUser(userid).catch(() => {});
      return NextResponse.redirect(mobileRedirect({ token }));
    }
    await issueSessionForUser(userid);
    await autoAcceptContactInvitesForUser(userid).catch(() => {});
    return NextResponse.redirect(new URL(resolveReturnPath(returnTo, { isSystemStaff: false }), base));
  } catch (err) {
    if (err instanceof AuthError && err.code === "sso_account_exists") {
      return NextResponse.redirect(
        mobile ? mobileRedirect({ error: "account_exists" }) : new URL("/signin?sso_error=account_exists", base),
      );
    }
    console.error(`[sso] sign-in failed (${provider}):`, (err as Error).message);
    return NextResponse.redirect(
      mobile ? mobileRedirect({ error: "failed" }) : new URL("/signin?sso_error=failed", base),
    );
  }
}
