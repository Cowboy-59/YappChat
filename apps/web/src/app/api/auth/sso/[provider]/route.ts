import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildStart, type SsoProvider } from "@/lib/auth/sso";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set(["google", "microsoft", "oidc"]);
const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth/sso",
  maxAge: 600, // 10 min to complete the round-trip
};

/**
 * GET /api/auth/sso/:provider — begin SSO: stash PKCE/state, redirect to the IdP.
 * `?intent=link` starts the explicit account-linking flow (FR-018) and requires
 * an authenticated session; otherwise it's a normal sign-in / provision.
 */
/** Native app deep-link the mobile SSO round-trip returns to (spec 008). */
const MOBILE_CALLBACK = "yappchat://auth";
function mobileRedirect(params: Record<string, string>): string {
  const u = new URL(MOBILE_CALLBACK);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const requestUrl = new URL(req.url);
  const origin = requestUrl.origin;
  // Mobile (spec 008): the in-app browser opens this URL with ?mode=mobile; the
  // callback then returns to the app via the `yappchat://auth?token=…` deep link.
  const mobile = requestUrl.searchParams.get("mode") === "mobile";
  if (!PROVIDERS.has(provider)) {
    return NextResponse.redirect(
      mobile ? mobileRedirect({ error: "unknown_provider" }) : new URL("/signin?sso_error=unknown_provider", origin),
    );
  }
  const intent = requestUrl.searchParams.get("intent") === "link" ? "link" : "signin";
  const returnTo = requestUrl.searchParams.get("return") ?? "/app";

  if (intent === "link" && !(await getSessionUser())) {
    return NextResponse.redirect(new URL(`/signin?return=${encodeURIComponent(returnTo)}`, origin));
  }

  try {
    const { url, codeVerifier, state } = await buildStart(provider as SsoProvider);
    const store = await cookies();
    store.set("yc_sso_v", codeVerifier, COOKIE_BASE);
    store.set("yc_sso_s", state, COOKIE_BASE);
    store.set("yc_sso_r", returnTo, COOKIE_BASE);
    store.set("yc_sso_p", provider, COOKIE_BASE);
    store.set("yc_sso_i", intent, COOKIE_BASE);
    store.set("yc_sso_m", mobile ? "1" : "0", COOKIE_BASE);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error(`[sso] start failed (${provider}):`, (err as Error).message);
    return NextResponse.redirect(
      mobile ? mobileRedirect({ error: "start_failed" }) : new URL("/signin?sso_error=start_failed", origin),
    );
  }
}
