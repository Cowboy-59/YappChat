import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { LANGUAGE_CODES } from "@/lib/account/languages";
import { MAX_ATTENDEES_CAP, createPresentation, listPresentations } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).optional(),
  // S3 key or preset path (resolved on read like spec 068 avatars), not a bare URL.
  coverimageurl: z.string().max(2048).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  communityid: z.string().uuid().nullable().optional(),
  spokenlanguage: z.enum(LANGUAGE_CODES).optional(),
  scheduledstart: z.coerce.date(),
  scheduledend: z.coerce.date().nullable().optional(),
  maxattendees: z.number().int().min(1).max(MAX_ATTENDEES_CAP).optional(),
});

/** GET /api/presentations — calendar feed (upcoming + past) the caller may see. */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await listPresentations(auth.user.id));
}

/** POST /api/presentations — schedule a presentation (caller becomes host). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const presentation = await createPresentation(parsed.data, auth.user.id);
    return NextResponse.json({ presentation }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
