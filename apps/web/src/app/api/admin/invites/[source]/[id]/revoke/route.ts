import { NextResponse } from "next/server";
import { engineError } from "@/lib/engine/http";
import { getSessionUser } from "@/lib/auth/session";
import { adminRevokeInvite, type AdminInviteSource } from "@/lib/admin/invites";

export const dynamic = "force-dynamic";

const SOURCES: AdminInviteSource[] = ["org", "community"];

/** POST /api/admin/invites/:source/:id/revoke — kill any live invite (source ∈
 *  {org, community}). Spec 013 FR-019. System-admin only. */
export async function POST(_req: Request, { params }: { params: Promise<{ source: string; id: string }> }) {
  const user = await getSessionUser();
  if (!user || !user.issystemadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { source, id } = await params;
  const src = SOURCES.find((s) => s === source);
  if (!src) return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  try {
    await adminRevokeInvite(src, id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
