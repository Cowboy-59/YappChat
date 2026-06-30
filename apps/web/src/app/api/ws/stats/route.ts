import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineFetch } from "@/lib/ws/internal";

export const dynamic = "force-dynamic";

/**
 * GET /api/ws/stats — WS engine capacity + broker stats (spec 003 T007).
 * System admins only. Used by an operator dashboard.
 */
export async function GET() {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const res = await engineFetch("/stats");
    if (!res.ok) return NextResponse.json({ error: "engine unavailable" }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "engine unavailable" }, { status: 502 });
  }
}
