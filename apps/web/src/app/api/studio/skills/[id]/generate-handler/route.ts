import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import { getSkill } from "@/lib/studio/skills";
import { DEPLOY_CHECKLIST, generateHandler, type HandlerLanguage } from "@/lib/studio/codegen";

export const dynamic = "force-dynamic";

const LANGS: HandlerLanguage[] = ["typescript", "python", "javascript"];

/** POST /api/studio/skills/:id/generate-handler { language } — returns handler source. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ language?: HandlerLanguage }>(req);
  const language = body?.language;
  if (!language || !LANGS.includes(language)) {
    return NextResponse.json({ error: "invalid_language" }, { status: 400 });
  }
  try {
    const skill = await getSkill(ctx.org.id, id);
    const generated = generateHandler({ name: skill.name, inputschema: skill.inputschema }, language);
    return NextResponse.json({ ...generated, checklist: DEPLOY_CHECKLIST });
  } catch (err) {
    return studioError(err);
  }
}
