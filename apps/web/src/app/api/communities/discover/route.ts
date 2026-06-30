import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { discoverCommunities } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

/** GET /api/communities/discover?q= — search PUBLIC communities (unlisted never shown). */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ communities: await discoverCommunities(auth.user.id, q) });
}
