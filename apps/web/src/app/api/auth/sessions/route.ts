import { NextResponse } from "next/server";
import { getCurrentSessionId, requireAuth } from "@/lib/auth/session";
import { listActiveSessions } from "@/lib/auth/devices";

export const dynamic = "force-dynamic";

/** GET /api/auth/sessions — the caller's active sessions (this device flagged). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const currentId = await getCurrentSessionId();
  const sessions = await listActiveSessions(auth.user.id, currentId);
  return NextResponse.json({ sessions });
}
