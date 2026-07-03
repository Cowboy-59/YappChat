import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { getRecordingShareLink } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/presentations/:id/recording/share — a 7-day shareable/download link to
 * the recording's S3 object (access-scoped like the replay). For sending to
 * someone or pasting into another app.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  try {
    return NextResponse.json(await getRecordingShareLink(id, user?.id ?? null));
  } catch (err) {
    return engineError(err);
  }
}
