import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { createSpaceInvite } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const InviteSchema = z.object({ ttlHours: z.number().int().positive().max(8760).optional() });

/** POST /api/communities/:id/spaces/:spaceid/invites — mint a single-use per-space
 *  invite link (capability: invite:create). FR-020. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; spaceid: string }> }) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "invite:create" });
  if (!ctx.ok) return ctx.response;
  const parsed = InviteSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const invite = await createSpaceInvite(id, spaceid, ctx.user.id, parsed.data.ttlHours);
    return NextResponse.json({ invite }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
