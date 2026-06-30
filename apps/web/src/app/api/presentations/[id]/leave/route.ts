import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { leavePresentation } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

// Guests (no session) leave by their attendee id, returned at join time.
const LeaveSchema = z.object({ attendeeid: z.string().uuid().optional() });

/** POST /api/presentations/:id/leave — mark the caller (or a guest) as left. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const parsed = LeaveSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    await leavePresentation(id, { userid: user?.id ?? null, attendeeid: parsed.data.attendeeid });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
