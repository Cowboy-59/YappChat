import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { isLanguageCode } from "@/lib/account/languages";
import { buildCaptionsVtt } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/presentations/:id/captions/vtt?lang=xx — WebVTT subtitle track for the
 * recording in the requested language (base = saved text; others translated).
 * Attached to the replay <video> as <track> so viewers can switch languages.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const langParam = new URL(req.url).searchParams.get("lang") ?? "en";
  const lang = isLanguageCode(langParam) ? langParam : "en";
  try {
    const vtt = await buildCaptionsVtt(id, user?.id ?? null, lang);
    return new NextResponse(vtt, {
      headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, max-age=300" },
    });
  } catch (err) {
    return engineError(err);
  }
}
