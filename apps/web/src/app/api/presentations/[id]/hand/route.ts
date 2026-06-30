import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { listHandQueue, lowerHand, raiseHand, resolveHand } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

const HandSchema = z.object({
  action: z.enum(["raise", "lower", "resolve"]),
  attendeeid: z.string().uuid().optional(),
});

/** GET /api/presentations/:id/hand — the host's ordered raise-hand queue. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ queue: await listHandQueue(id, auth.user.id) });
  } catch (err) {
    return engineError(err);
  }
}

/**
 * POST /api/presentations/:id/hand — raise/lower your own hand, or (host) resolve
 * a queued one. raise/lower allow guests (by attendeeid); resolve is host-only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = HandSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  const { action, attendeeid } = parsed.data;
  try {
    if (action === "resolve") {
      const auth = await requireAuth();
      if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!attendeeid) return NextResponse.json({ error: "attendeeid_required" }, { status: 422 });
      await resolveHand(id, attendeeid, auth.user.id);
    } else {
      const user = await getSessionUser();
      const by = { userid: user?.id ?? null, attendeeid };
      if (action === "raise") await raiseHand(id, by);
      else await lowerHand(id, by);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
