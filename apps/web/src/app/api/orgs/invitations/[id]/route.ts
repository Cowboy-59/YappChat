import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { resendOrgInvitation, revokeInvite } from "@/lib/orgs/service";

export const dynamic = "force-dynamic";

/** DELETE /api/orgs/invitations/:id — revoke a pending invite (owner/admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ orgRole: "admin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.org) return NextResponse.json({ error: "no_org" }, { status: 403 });
  const { id } = await params;
  try {
    await revokeInvite(auth.org.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}

/** POST /api/orgs/invitations/:id — resend a pending invite (owner/admin). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ orgRole: "admin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.org) return NextResponse.json({ error: "no_org" }, { status: 403 });
  const { id } = await params;
  try {
    await resendOrgInvitation(auth.org.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
