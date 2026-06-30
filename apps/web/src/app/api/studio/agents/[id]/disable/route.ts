import { NextResponse } from "next/server";
import { studioContext, studioError } from "@/lib/studio/http";
import { setAgentEnabled } from "@/lib/studio/agents";

export const dynamic = "force-dynamic";

/** PATCH /api/studio/agents/:id/disable */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json({ agent: await setAgentEnabled(ctx.org.id, id, false) });
  } catch (err) {
    return studioError(err);
  }
}
