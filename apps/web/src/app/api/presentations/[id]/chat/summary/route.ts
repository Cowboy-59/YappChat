import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { summarizePresentationChat } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/presentations/:id/chat/summary — FR-028 access-scoped chat transcript +
 * a short AI recap for the replay screen.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  try {
    return NextResponse.json(await summarizePresentationChat(id, user?.id ?? null));
  } catch (err) {
    return engineError(err);
  }
}
