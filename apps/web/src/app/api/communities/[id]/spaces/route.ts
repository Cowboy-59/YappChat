import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { createSpace, listSpaces } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

// FR-019 — optional per-space support AI captured at creation.
const AiSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("website"), url: z.string().trim().url().max(2000) }),
  z.object({ kind: z.literal("document"), storagekey: z.string().trim().min(1).max(500), title: z.string().max(200).optional() }),
]);
const AiSchema = z.object({
  enabled: z.boolean(),
  autoanswer: z.boolean().optional(),
  includehistory: z.boolean().optional(),
  model: z.string().max(100).optional(),
  sources: z.array(AiSourceSchema).max(20).optional(),
});

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  topic: z.string().max(500).optional(),
  mode: z.enum(["chat", "broadcast"]).optional(),
  discoverability: z.enum(["public", "unlisted"]).optional(),
  joinpolicy: z.enum(["open", "approval", "invite"]).optional(),
  adminonly: z.boolean().optional(),
  corponly: z.boolean().optional(),
  ai: AiSchema.optional(),
});

/** GET /api/communities/:id/spaces — spaces in a community (members only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ spaces: await listSpaces(id) });
}

/** POST /api/communities/:id/spaces — create a space (capability: space:create). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMembership(id, { capability: "space:create" });
  if (!ctx.ok) return ctx.response;
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const space = await createSpace(id, parsed.data);
    return NextResponse.json({ space }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
