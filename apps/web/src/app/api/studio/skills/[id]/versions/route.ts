import { NextResponse } from "next/server";
import { studioContext, studioError } from "@/lib/studio/http";
import { getSkillVersions } from "@/lib/studio/skills";

export const dynamic = "force-dynamic";

/** GET /api/studio/skills/:id/versions — full history, newest first. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json({ versions: await getSkillVersions(ctx.org.id, id) });
  } catch (err) {
    return studioError(err);
  }
}
