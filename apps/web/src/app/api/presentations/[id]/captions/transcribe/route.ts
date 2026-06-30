import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { transcribeAndIngest } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/presentations/:id/captions/transcribe (multipart: `audio`, `offsetms`)
 * — host streams a short audio chunk; GROQ Whisper transcribes it in the spoken
 * language and the line is stored + broadcast. Host only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "audio_required" }, { status: 400 });
  }
  const offsetRaw = form?.get("offsetms");
  const offset = typeof offsetRaw === "string" && offsetRaw !== "" ? Number(offsetRaw) : NaN;
  const offsetms = Number.isFinite(offset) ? offset : null;

  try {
    return NextResponse.json(await transcribeAndIngest(id, audio, offsetms, auth.user.id));
  } catch (err) {
    return engineError(err);
  }
}
