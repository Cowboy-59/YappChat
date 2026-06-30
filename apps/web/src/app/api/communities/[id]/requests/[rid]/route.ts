import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { decideJoinRequest } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const DecideSchema = z.object({ decision: z.enum(["approve", "deny"]) });

/** POST /api/communities/:id/requests/:rid — approve/deny (capability: request:decide). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const ctx = await requireMembership(id, { capability: "request:decide" });
  if (!ctx.ok) return ctx.response;
  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const request = await decideJoinRequest(id, rid, ctx.user.id, parsed.data.decision === "approve");
    return NextResponse.json({ request });
  } catch (err) {
    return engineError(err);
  }
}
