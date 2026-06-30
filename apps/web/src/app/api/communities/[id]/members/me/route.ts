import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { setAvailability } from "@/lib/communities/service";
import { removeMember } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const AvailabilitySchema = z
  .object({
    availabilitystatus: z.string().trim().max(32).nullable().optional(),
    availabilitynote: z.string().trim().max(280).nullable().optional(),
  })
  .strict();

/** PATCH /api/communities/:id/members/me — set the caller's own availability (any member). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id); // any member may set their own availability
  if (!ctx.ok) return ctx.response;
  const parsed = AvailabilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    await setAvailability(id, ctx.user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/communities/:id/members/me — leave the community (any member can
 *  leave themselves; the last owner is blocked by removeMember → 409 last_owner). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id);
  if (!ctx.ok) return ctx.response;
  try {
    await removeMember(id, ctx.user.id, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
