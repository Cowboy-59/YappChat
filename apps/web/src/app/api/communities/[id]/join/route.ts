import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { joinCommunity } from "@/lib/communities/membership";

export const dynamic = "force-dynamic";

const JoinSchema = z.object({
  inviteToken: z.string().min(1).optional(),
  message: z.string().max(1000).optional(),
});

/** POST /api/communities/:id/join — join, request to join, or use an invite. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const parsed = JoinSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const result = await joinCommunity(id, auth.user.id, parsed.data);
    return NextResponse.json(result, { status: result.status === "member" ? 200 : 202 });
  } catch (err) {
    return engineError(err);
  }
}
