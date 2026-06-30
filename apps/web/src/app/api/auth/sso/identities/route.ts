import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listSsoIdentities } from "@/lib/auth/service";
import { configuredProviders } from "@/lib/auth/sso";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sso/identities — the caller's linked SSO identities, whether they
 * also have a password (drives last-method protection), and the configured
 * providers not yet linked (so the UI can offer "Connect").
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { identities, hasPassword } = await listSsoIdentities(auth.user.id);
  const linked = new Set(identities.map((i) => i.provider));
  const available = configuredProviders().filter((p) => !linked.has(p.key));
  return NextResponse.json({ identities, hasPassword, available });
}
