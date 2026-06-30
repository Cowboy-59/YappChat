import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/communities/policy";
import { listAudit } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

/** GET /api/communities/:id/audit — community moderation log (capability: audit:view). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id, { capability: "audit:view" });
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ audit: await listAudit(id) });
}
