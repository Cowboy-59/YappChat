import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { unfreezeContactRequests } from "@/lib/contacts/flood";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/contact-freezes/[id]/unfreeze — clear a contact-request freeze.
 * Spec 018 delta §5 (FR-018-77/61). System-admin only, re-verified server-side;
 * no self-service (the endpoint is not reachable without the sysadmin flag).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const res = await unfreezeContactRequests(id, auth.user.id);
  if (!res.ok) return NextResponse.json({ error: "not_active" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
