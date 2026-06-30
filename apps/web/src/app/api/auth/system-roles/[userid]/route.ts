import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/http";
import { requireAuth } from "@/lib/auth/session";
import { setSystemRoles } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** PATCH /api/auth/system-roles/:userid — grant/revoke system flags (issystemadmin only). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userid: string }> },
) {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userid } = await params;
  const body = await readJson<{
    issystemadmin?: boolean;
    isbillingadmin?: boolean;
    issupport?: boolean;
  }>(req);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  await setSystemRoles(userid, body, auth.user.id);
  return NextResponse.json({ ok: true });
}
