import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { startPresentation } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/** POST /api/presentations/:id/start — host opens the room (status → live). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ presentation: await startPresentation(id, auth.user.id) });
  } catch (err) {
    return engineError(err);
  }
}
