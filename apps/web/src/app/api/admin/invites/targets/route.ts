import { NextResponse } from "next/server";
import { engineError } from "@/lib/engine/http";
import { getSessionUser } from "@/lib/auth/session";
import { isSystemStaff } from "@/lib/auth/shared";
import { listInviteTargets } from "@/lib/admin/invites";

export const dynamic = "force-dynamic";

/** GET /api/admin/invites/targets — corporate orgs + communities/spaces to populate
 *  the create form. Spec 013 FR-019. System-staff read. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !isSystemStaff(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await listInviteTargets());
  } catch (err) {
    return engineError(err);
  }
}
