import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { inviteOrgMember } from "@/lib/orgs/service";

export const dynamic = "force-dynamic";

/** POST /api/orgs/invitations — invite a colleague by email (owner/admin). */
export async function POST(req: Request) {
  const auth = await requireAuth({ orgRole: "admin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.org) return NextResponse.json({ error: "no_org" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { email?: string; role?: string } | null;
  const email = (body?.email ?? "").trim();
  const role = body?.role === "admin" ? "admin" : "member";
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });
  try {
    await inviteOrgMember({ orgid: auth.org.id, email, role, invitedby: auth.user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
