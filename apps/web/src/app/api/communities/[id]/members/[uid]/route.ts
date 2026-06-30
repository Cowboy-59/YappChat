import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { removeMember, setMemberRole } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const RoleSchema = z.object({ role: z.enum(["owner", "moderator", "member"]) });

/** PATCH /api/communities/:id/members/:uid — change role (capability: member:role:set). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const { id, uid } = await params;
  const ctx = await requireMembership(id, { capability: "member:role:set" });
  if (!ctx.ok) return ctx.response;
  const parsed = RoleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    await setMemberRole(id, uid, parsed.data.role, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/communities/:id/members/:uid — remove a member (capability: member:remove). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const { id, uid } = await params;
  const ctx = await requireMembership(id, { capability: "member:remove" });
  if (!ctx.ok) return ctx.response;
  try {
    await removeMember(id, uid, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
