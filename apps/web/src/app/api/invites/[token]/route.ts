import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { resolveInvite } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

/** GET /api/invites/:token — token-first preview of an invite (community + space
 *  name + validity) WITHOUT consuming it. Auth-gated so it isn't anonymously
 *  scrapeable; the token itself is the secret. FR-020. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { token } = await params;
  const preview = await resolveInvite(token);
  if (!preview) return NextResponse.json({ error: "invalid_invite" }, { status: 404 });
  return NextResponse.json({ preview });
}
