import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { createSpaceInvite, listInvites } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

// FR-021: `maxuses` — a positive cap, `null` = unlimited, omitted = single-use (1).
// `ttlHours` capped at 90 days (2160h) per FR-021 (no perpetual links).
const InviteSchema = z.object({
  ttlHours: z.number().int().positive().max(2160).optional(),
  maxuses: z.number().int().positive().max(100000).nullable().optional(),
});

/** POST /api/communities/:id/spaces/:spaceid/invites — mint a per-space invite link
 *  (capability: invite:create). Single-use by default; FR-021 reusable via `maxuses`
 *  (rejected for admin/corp-only spaces). FR-020/FR-021. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; spaceid: string }> }) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "invite:create" });
  if (!ctx.ok) return ctx.response;
  const parsed = InviteSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const invite = await createSpaceInvite(id, spaceid, ctx.user.id, parsed.data.ttlHours, parsed.data.maxuses);
    return NextResponse.json({ invite }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}

/** GET /api/communities/:id/spaces/:spaceid/invites — list this space's live invite
 *  links (metadata only; tokens are shown once at creation). FR-021. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; spaceid: string }> }) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "invite:create" });
  if (!ctx.ok) return ctx.response;
  try {
    return NextResponse.json({ invites: await listInvites(id, spaceid) });
  } catch (err) {
    return engineError(err);
  }
}
