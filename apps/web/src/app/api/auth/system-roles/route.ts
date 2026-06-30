import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listSystemRoleUsers } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** GET /api/auth/system-roles — list users with any system flag (FR-010). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // Visible to issystemadmin OR issupport.
  if (!auth.user.issystemadmin && !auth.user.issupport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ users: await listSystemRoleUsers() });
}
