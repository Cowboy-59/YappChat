import * as oidc from "openid-client";
import { getSiteUrl } from "../site";

/**
 * Spec 011 T007 — SSO via OpenID Connect. Google, Microsoft (Entra), and a
 * generic OIDC provider all speak OIDC, so one connector (openid-client) serves
 * all three; each is enabled purely by its env config. Security: PKCE (S256) +
 * state, with the authorization-code grant + id_token validation handled by the
 * vetted library. We then issue our own opaque session (see service.ts).
 */

export type SsoProvider = "google" | "microsoft" | "oidc";

type ProviderDef = {
  key: SsoProvider;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
};

function providerDefs(): ProviderDef[] {
  const defs: ProviderDef[] = [];
  const g = process.env;
  if (g.GOOGLE_CLIENT_ID && g.GOOGLE_CLIENT_SECRET) {
    defs.push({
      key: "google",
      label: "Google",
      issuer: "https://accounts.google.com",
      clientId: g.GOOGLE_CLIENT_ID,
      clientSecret: g.GOOGLE_CLIENT_SECRET,
      scope: "openid email profile",
    });
  }
  if (g.MICROSOFT_CLIENT_ID && g.MICROSOFT_CLIENT_SECRET) {
    defs.push({
      key: "microsoft",
      label: "Microsoft",
      issuer: `https://login.microsoftonline.com/${g.MICROSOFT_TENANT || "common"}/v2.0`,
      clientId: g.MICROSOFT_CLIENT_ID,
      clientSecret: g.MICROSOFT_CLIENT_SECRET,
      scope: "openid email profile",
    });
  }
  if (g.OIDC_ISSUER && g.OIDC_CLIENT_ID && g.OIDC_CLIENT_SECRET) {
    defs.push({
      key: "oidc",
      label: g.OIDC_LABEL || "SSO",
      issuer: g.OIDC_ISSUER,
      clientId: g.OIDC_CLIENT_ID,
      clientSecret: g.OIDC_CLIENT_SECRET,
      scope: "openid email profile",
    });
  }
  return defs;
}

/** Providers that are actually configured — drives which buttons the UI shows. */
export function configuredProviders(): { key: SsoProvider; label: string }[] {
  return providerDefs().map((d) => ({ key: d.key, label: d.label }));
}

function defFor(provider: string): ProviderDef {
  const d = providerDefs().find((x) => x.key === provider);
  if (!d) throw new Error(`SSO provider not configured: ${provider}`);
  return d;
}

const configCache = new Map<string, oidc.Configuration>();
async function getConfig(d: ProviderDef): Promise<oidc.Configuration> {
  const cached = configCache.get(d.key);
  if (cached) return cached;
  const config = await oidc.discovery(new URL(d.issuer), d.clientId, d.clientSecret);
  configCache.set(d.key, config);
  return config;
}

export function redirectUriFor(provider: SsoProvider): string {
  return `${getSiteUrl()}/api/auth/sso/${provider}/callback`;
}

/** Build the authorization-endpoint URL + the PKCE/state to stash in cookies. */
export async function buildStart(provider: SsoProvider): Promise<{ url: string; codeVerifier: string; state: string }> {
  const d = defFor(provider);
  const config = await getConfig(d);
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUriFor(provider),
    scope: d.scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return { url: url.href, codeVerifier, state };
}

export type SsoClaims = { sub: string; email: string; emailVerified: boolean; name: string | null };

/** Complete the callback: exchange the code, validate, and extract identity claims. */
export async function completeCallback(
  provider: SsoProvider,
  currentUrl: URL,
  opts: { codeVerifier: string; state: string },
): Promise<SsoClaims> {
  const d = defFor(provider);
  const config = await getConfig(d);
  const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: opts.codeVerifier,
    expectedState: opts.state,
  });
  const claims = tokens.claims();
  if (!claims) throw new Error("no id_token claims in SSO response");
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email) throw new Error("no email claim from SSO provider");
  return {
    sub: String(claims.sub),
    email,
    emailVerified: claims.email_verified !== false, // treat absent as verified (Google/Entra set it)
    name: typeof claims.name === "string" ? claims.name : null,
  };
}
