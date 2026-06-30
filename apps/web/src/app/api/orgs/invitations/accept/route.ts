import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/constants";
import { engineError } from "@/lib/engine/http";
import { acceptOrgInvitation } from "@/lib/orgs/service";

export const dynamic = "force-dynamic";

/** POST /api/orgs/invitations/accept — accept an invite as the logged-in user, and
 *  make the joined company the active org so the member lands in it immediately. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = (body?.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 });
  try {
    const { orgid } = await acceptOrgInvitation(token, auth.user.id, auth.user.email);
    const store = await cookies();
    store.set(ACTIVE_ORG_COOKIE, orgid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json({ ok: true, orgid });
  } catch (err) {
    return engineError(err);
  }
}
