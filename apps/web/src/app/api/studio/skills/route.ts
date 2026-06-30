import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import { createSkill, listSkills } from "@/lib/studio/skills";

export const dynamic = "force-dynamic";

/** GET /api/studio/skills — org skill catalog (filter/search via query). */
export async function GET(req: Request) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const url = new URL(req.url);
  const q = url.searchParams;
  const boolParam = (k: string) => (q.has(k) ? q.get(k) === "true" : undefined);
  const skills = await listSkills(ctx.org.id, {
    category: q.get("category") ?? undefined,
    enabled: boolParam("enabled"),
    async: boolParam("async"),
    createdby: q.get("createdby") ?? undefined,
    search: q.get("search") ?? undefined,
  });
  return NextResponse.json({ skills });
}

/** POST /api/studio/skills — create (returns plaintext skilltoken ONCE). */
export async function POST(req: Request) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson(req);
  try {
    const result = await createSkill(ctx.org.id, ctx.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return studioError(err);
  }
}
