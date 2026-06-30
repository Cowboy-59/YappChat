import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listUserOrgs, requireAuth } from "@/lib/auth/session";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/constants";

export const dynamic = "force-dynamic";

/** POST /api/orgs/active { orgid } — switch the caller's active org (must be a member). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as { orgid?: string } | null;
  const orgid = (body?.orgid ?? "").trim();
  const orgs = await listUserOrgs(auth.user.id);
  if (!orgs.some((o) => o.id === orgid)) {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, orgid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
