import { NextResponse } from "next/server";
import { studioContext, studioError } from "@/lib/studio/http";
import { setSkillEnabled } from "@/lib/studio/skills";

export const dynamic = "force-dynamic";

/** PATCH /api/studio/skills/:id/enable — enable immediately (no restart). */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json({ skill: await setSkillEnabled(ctx.org.id, id, true) });
  } catch (err) {
    return studioError(err);
  }
}
