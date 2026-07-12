import { NextResponse } from "next/server";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { revokeInvite } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

/** POST /api/communities/:id/invites/:inviteid/revoke — kill a standing invite link
 *  immediately, regardless of remaining uses (capability: invite:create). FR-021. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; inviteid: string }> }) {
  const { id, inviteid } = await params;
  const ctx = await requireMembership(id, { capability: "invite:create" });
  if (!ctx.ok) return ctx.response;
  try {
    await revokeInvite(id, inviteid, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
