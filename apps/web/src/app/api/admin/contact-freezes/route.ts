import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listActiveFreezes } from "@/lib/contacts/flood";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/contact-freezes — list active contact-request flood freezes.
 * Spec 018 delta §5 (FR-018-77). System-admin only, enforced server-side.
 */
export async function GET() {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ freezes: await listActiveFreezes() });
}
