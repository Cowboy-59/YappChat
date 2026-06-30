import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { LANGUAGE_CODES } from "@/lib/account/languages";
import {
  MAX_ATTENDEES_CAP,
  cancelPresentation,
  getPresentationForViewer,
  updatePresentation,
} from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(4000).optional(),
    coverimageurl: z.string().max(2048).nullable().optional(),
    visibility: z.enum(["public", "private"]).optional(),
    communityid: z.string().uuid().nullable().optional(),
    spokenlanguage: z.enum(LANGUAGE_CODES).optional(),
    scheduledstart: z.coerce.date().optional(),
    scheduledend: z.coerce.date().nullable().optional(),
    maxattendees: z.number().int().min(1).max(MAX_ATTENDEES_CAP).optional(),
  })
  .strict();

/** GET /api/presentations/:id — detail, access-filtered to host/public/community. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ presentation: await getPresentationForViewer(id, auth.user.id) });
  } catch (err) {
    return engineError(err);
  }
}

/** PATCH /api/presentations/:id — edit while scheduled (host only). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    return NextResponse.json({ presentation: await updatePresentation(id, parsed.data, auth.user.id) });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/presentations/:id — cancel the presentation (host only). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    await cancelPresentation(id, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
