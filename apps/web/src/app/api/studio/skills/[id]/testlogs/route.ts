import { NextResponse } from "next/server";
import { studioContext, studioError } from "@/lib/studio/http";
import { getSkillTestLogs } from "@/lib/studio/skills";

export const dynamic = "force-dynamic";

/** GET /api/studio/skills/:id/testlogs — recent test history. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json({ logs: await getSkillTestLogs(ctx.org.id, id) });
  } catch (err) {
    return studioError(err);
  }
}
