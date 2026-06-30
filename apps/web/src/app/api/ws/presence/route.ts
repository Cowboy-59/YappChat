import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth, getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { orgmemberships } from "@/lib/db/auth-schema";
import { engineFetch } from "@/lib/ws/internal";

export const dynamic = "force-dynamic";

/**
 * GET /api/ws/presence?orgid= — current presence map for an org (spec 003 T006).
 * Visible to authenticated members of that org only. Proxies the live in-memory
 * state from the WS engine (presence is never persisted).
 */
export async function GET(req: Request) {
  const auth = await requireAuth({ orgRole: "member" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orgid = new URL(req.url).searchParams.get("orgid");
  if (!orgid) return NextResponse.json({ error: "orgid required" }, { status: 400 });

  // Must be a member of the REQUESTED org (not just the active one).
  const user = await getSessionUser();
  const db = getDb();
  if (!user || !db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [member] = await db
    .select({ id: orgmemberships.id })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.userid, user.id), eq(orgmemberships.orgid, orgid)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const res = await engineFetch(`/presence?orgid=${encodeURIComponent(orgid)}`);
    if (!res.ok) return NextResponse.json({}, { status: 200 });
    return NextResponse.json(await res.json());
  } catch {
    // Engine down → empty presence rather than a hard failure.
    return NextResponse.json({}, { status: 200 });
  }
}
