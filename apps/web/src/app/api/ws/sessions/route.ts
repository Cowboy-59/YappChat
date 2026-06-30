import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { wssessions } from "@/lib/db/ws-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/ws/sessions — list active WS sessions (spec 003 T001). System admins
 * only. Reads the DB-backed `wssessions` registry directly.
 */
export async function GET() {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getDb();
  if (!db) return NextResponse.json({ sessions: [] });

  const rows = await db
    .select({
      id: wssessions.id,
      userid: wssessions.userid,
      subscriptions: wssessions.subscriptions,
      connectedat: wssessions.connectedat,
      lastheartbeat: wssessions.lastheartbeat,
    })
    .from(wssessions)
    .orderBy(desc(wssessions.connectedat));

  return NextResponse.json({ sessions: rows });
}
