import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { deleteRecording } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/** DELETE /api/presentations/:id/recording/:recordingId — host deletes a recording. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; recordingId: string }> },
) {
  const { id, recordingId } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    await deleteRecording(id, recordingId, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
