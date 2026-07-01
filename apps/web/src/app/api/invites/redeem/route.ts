import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { redeemInvite } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const RedeemSchema = z.object({ token: z.string().min(1) });

/** POST /api/invites/redeem — consume an invite for the signed-in user. Joins the
 *  community if needed and admits them to the invited space, overriding its strict
 *  policy. Single-use. FR-020. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = RedeemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error?.flatten() }, { status: 422 });
  try {
    return NextResponse.json(await redeemInvite(parsed.data.token, auth.user.id));
  } catch (err) {
    return engineError(err);
  }
}
