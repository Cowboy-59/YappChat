import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/communities/policy";
import { listJoinRequests } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

/** GET /api/communities/:id/requests — pending join requests (capability: request:decide). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id, { capability: "request:decide" });
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ requests: await listJoinRequests(id, "pending") });
}
