import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { spaces } from "@/lib/db/communities-schema";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { configureSpaceAi, getSpaceAiState } from "@/lib/communities/spaceai";
import { indexSpaceAi, refreshSpaceAi } from "@/lib/communities/spaceai-index";

export const dynamic = "force-dynamic";

/** Confirm the space exists AND belongs to the community in the path. */
async function assertSpaceInCommunity(communityid: string, spaceid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, spaceid), eq(spaces.communityid, communityid)))
    .limit(1);
  return Boolean(row);
}

const AiSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("website"), url: z.string().trim().url().max(2000) }),
  z.object({ kind: z.literal("document"), storagekey: z.string().trim().min(1).max(500), title: z.string().max(200).optional() }),
]);
const PatchSchema = z.object({
  enabled: z.boolean(),
  autoanswer: z.boolean().optional(),
  includehistory: z.boolean().optional(),
  model: z.string().max(100).optional(),
  sources: z.array(AiSourceSchema).max(20).optional(),
});

type Params = { params: Promise<{ id: string; spaceid: string }> };

/** GET — current AI config + source/index status (any member). */
export async function GET(_req: Request, { params }: Params) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id);
  if (!ctx.ok) return ctx.response;
  if (!(await assertSpaceInCommunity(id, spaceid))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(await getSpaceAiState(spaceid));
}

/** PATCH — enable/disable + reconfigure sources (capability: space:update). */
export async function PATCH(req: Request, { params }: Params) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "space:update" });
  if (!ctx.ok) return ctx.response;
  if (!(await assertSpaceInCommunity(id, spaceid))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const state = await configureSpaceAi(spaceid, parsed.data);
    if (parsed.data.enabled) void indexSpaceAi(spaceid).catch((err) => console.error("[spaceai] index failed:", err));
    return NextResponse.json(state);
  } catch (err) {
    return engineError(err);
  }
}

/** POST — re-crawl/re-index the space's sources (capability: space:update). */
export async function POST(_req: Request, { params }: Params) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "space:update" });
  if (!ctx.ok) return ctx.response;
  if (!(await assertSpaceInCommunity(id, spaceid))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Kick off in the background; the client polls GET for status.
  void refreshSpaceAi(spaceid).catch((err) => console.error("[spaceai] refresh failed:", err));
  return NextResponse.json({ ok: true }, { status: 202 });
}
