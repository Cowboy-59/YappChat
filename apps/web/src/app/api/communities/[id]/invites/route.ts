import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { createInvite } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const InviteSchema = z.object({ ttlHours: z.number().int().positive().max(8760).optional() });

/** POST /api/communities/:id/invites — mint a single-use invite (capability: invite:create). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id, { capability: "invite:create" });
  if (!ctx.ok) return ctx.response;
  const parsed = InviteSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const invite = await createInvite(id, ctx.user.id, parsed.data.ttlHours);
    return NextResponse.json({ invite }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
