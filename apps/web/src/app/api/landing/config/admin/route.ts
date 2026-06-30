import { NextResponse } from "next/server";
import { getSessionUser, isSystemStaff } from "@/lib/auth/session";
import { getFullConfig } from "@/lib/landing/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/landing/config/admin — full config including audit fields.
 * Requires a system-staff session (issystemadmin / isbillingadmin / issupport).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSystemStaff(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const full = await getFullConfig();
  return NextResponse.json(full);
}
