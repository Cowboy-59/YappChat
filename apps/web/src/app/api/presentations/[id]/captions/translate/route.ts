import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { LANGUAGE_CODES } from "@/lib/account/languages";
import { translateCaption } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

// Available to any participant who can view the presentation (guests on public ones).
const TranslateSchema = z.object({
  text: z.string().min(1).max(2000),
  to: z.enum(LANGUAGE_CODES),
  from: z.enum(LANGUAGE_CODES).optional(),
});

/** POST /api/presentations/:id/captions/translate — translate one caption line for a viewer. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const parsed = TranslateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    return NextResponse.json(await translateCaption(id, user?.id ?? null, parsed.data));
  } catch (err) {
    return engineError(err);
  }
}
