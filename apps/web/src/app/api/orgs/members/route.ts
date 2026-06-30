import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listOrgMembers, listPendingInvites } from "@/lib/orgs/service";

export const dynamic = "force-dynamic";

/** GET /api/orgs/members — directory for any corporate member. Pending invites +
 *  management are owner/admin only (the UI hides controls when canManage is false). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const org = auth.org;
  if (!org || org.plantype !== "corporate") return NextResponse.json({ error: "not_corporate" }, { status: 403 });
  const canManage = org.role === "owner" || org.role === "admin";
  const [members, invites] = await Promise.all([
    listOrgMembers(org.id),
    canManage ? listPendingInvites(org.id) : Promise.resolve([]),
  ]);
  return NextResponse.json({
    org: { id: org.id, name: org.name, plantype: org.plantype, role: org.role },
    me: auth.user.id,
    canManage,
    members,
    invites,
  });
}
