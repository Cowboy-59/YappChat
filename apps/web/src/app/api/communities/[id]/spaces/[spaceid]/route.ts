import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { deleteSpace, updateSpace } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  topic: z.string().max(500).optional(),
  mode: z.enum(["chat", "broadcast"]).optional(),
  discoverability: z.enum(["public", "unlisted"]).nullable().optional(),
  joinpolicy: z.enum(["open", "approval", "invite"]).nullable().optional(),
  adminonly: z.boolean().optional(),
  corponly: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string; spaceid: string }> };

/** PATCH /api/communities/:id/spaces/:spaceid — edit a space (capability: space:update). */
export async function PATCH(req: Request, { params }: Params) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "space:update" });
  if (!ctx.ok) return ctx.response;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    return NextResponse.json({ space: await updateSpace(id, spaceid, parsed.data) });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/communities/:id/spaces/:spaceid — delete a space (capability: space:delete). */
export async function DELETE(_req: Request, { params }: Params) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "space:delete" });
  if (!ctx.ok) return ctx.response;
  try {
    await deleteSpace(id, spaceid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
