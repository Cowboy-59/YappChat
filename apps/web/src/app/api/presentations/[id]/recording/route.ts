import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { getReplay } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/** GET /api/presentations/:id/recording — access-scoped replay (presigned URL). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  try {
    return NextResponse.json(await getReplay(id, user?.id ?? null));
  } catch (err) {
    return engineError(err);
  }
}
