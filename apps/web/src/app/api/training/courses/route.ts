import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { createCourse, listCourses } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/** GET /api/training/courses?spaceId=… — the space's Training library (access-scoped). */
export async function GET(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const spaceId = new URL(req.url).searchParams.get("spaceId");
  if (!spaceId) return NextResponse.json({ error: "spaceId_required" }, { status: 400 });
  try {
    return NextResponse.json({ courses: await listCourses(spaceId, ctx.user.id) });
  } catch (err) {
    return engineError(err);
  }
}

/** POST /api/training/courses — create a course in a space (author only). */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ spaceId?: string; title?: string; description?: string }>(req);
  if (!body?.spaceId || !body.title) {
    return NextResponse.json({ error: "spaceId_and_title_required" }, { status: 400 });
  }
  try {
    const course = await createCourse(body.spaceId, ctx.user.id, { title: body.title, description: body.description });
    return NextResponse.json({ course }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
