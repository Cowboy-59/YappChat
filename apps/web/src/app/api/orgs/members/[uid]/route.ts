import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { removeOrgMember, setOrgMemberRole } from "@/lib/orgs/service";

export const dynamic = "force-dynamic";

/** DELETE /api/orgs/members/:uid — remove a member from the org (owner/admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await requireAuth({ orgRole: "admin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.org) return NextResponse.json({ error: "no_org" }, { status: 403 });
  const { uid } = await params;
  try {
    await removeOrgMember(auth.org.id, uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}

/** PATCH /api/orgs/members/:uid — change a member's role (owner/admin). */
export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await requireAuth({ orgRole: "admin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.org) return NextResponse.json({ error: "no_org" }, { status: 403 });
  const { uid } = await params;
  const body = (await req.json().catch(() => null)) as { role?: string } | null;
  const role = body?.role;
  if (role !== "owner" && role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  try {
    await setOrgMemberRole(auth.org.id, uid, role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
