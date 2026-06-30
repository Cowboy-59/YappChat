import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { deleteCommunity, getCommunity, updateCommunity } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  avatarurl: z.string().url().nullable().optional(),
  discoverability: z.enum(["public", "unlisted"]).optional(),
  joinpolicy: z.enum(["open", "approval", "invite"]).optional(),
  retentionpolicy: z.enum(["forever", "days"]).optional(),
  retentiondays: z.number().int().positive().nullable().optional(),
});

/** GET /api/communities/:id — community detail (members only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id);
  if (!ctx.ok) return ctx.response;
  try {
    return NextResponse.json({ community: await getCommunity(id), role: ctx.role });
  } catch (err) {
    return engineError(err);
  }
}

/** PATCH /api/communities/:id — edit settings (capability: community:update). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id, { capability: "community:update" });
  if (!ctx.ok) return ctx.response;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    return NextResponse.json({ community: await updateCommunity(id, parsed.data) });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/communities/:id — delete the community (capability: community:delete). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id, { capability: "community:delete" });
  if (!ctx.ok) return ctx.response;
  try {
    await deleteCommunity(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
