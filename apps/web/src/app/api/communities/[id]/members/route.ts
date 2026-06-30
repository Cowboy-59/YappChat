import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/communities/policy";
import { listMembers } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

/** GET /api/communities/:id/members — member directory (members only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ members: await listMembers(id) });
}
