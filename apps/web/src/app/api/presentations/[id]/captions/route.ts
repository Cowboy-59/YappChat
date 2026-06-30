import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { LANGUAGE_CODES } from "@/lib/account/languages";
import { ingestCaption, listCaptions } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

const IngestSchema = z.object({
  text: z.string().min(1).max(2000),
  language: z.enum(LANGUAGE_CODES).optional(),
  offsetms: z.number().int().nonnegative().nullable().optional(),
});

/** GET /api/presentations/:id/captions — stored caption lines (access-filtered) for replay. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  try {
    return NextResponse.json({ captions: await listCaptions(id, user?.id ?? null) });
  } catch (err) {
    return engineError(err);
  }
}

/** POST /api/presentations/:id/captions — host posts a finalized caption line. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = IngestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    await ingestCaption(id, parsed.data, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
