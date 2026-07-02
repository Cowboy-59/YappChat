import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { joinPresentation } from "@/lib/presentations/service";
import { connectionFor } from "@/lib/presentations/livekit";

export const dynamic = "force-dynamic";

// Auth is OPTIONAL here: anonymous guests may join a public presentation.
const JoinSchema = z.object({
  token: z.string().max(512).optional(),
  guestname: z.string().trim().min(1).max(80).optional(),
});

/** POST /api/presentations/:id/join — admit the caller (or a guest) to the room. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const parsed = JoinSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { attendee, presentation } = await joinPresentation(id, {
      userid: user?.id ?? null,
      token: parsed.data.token,
      guestname: parsed.data.guestname,
    });
    // LiveKit connection for the joined participant (host publishes, others watch).
    // null when LiveKit isn't configured — the room still works without live media.
    // ENDED presentations are view-only replay: no live connection.
    const livekit =
      presentation.status === "ended"
        ? null
        : connectionFor(presentation.id, {
            identity: attendee.userid ?? `guest-${attendee.id}`,
            name: user?.displayname ?? attendee.guestname ?? "Guest",
            isHost: attendee.role === "host",
          });
    return NextResponse.json({
      attendee,
      presentation: {
        id: presentation.id,
        title: presentation.title,
        visibility: presentation.visibility,
        status: presentation.status,
        spokenlanguage: presentation.spokenlanguage,
      },
      livekit,
    });
  } catch (err) {
    return engineError(err);
  }
}
