import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { deleteCourse, getCourse, updateCourse } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/** GET /api/training/courses/:id — course detail + ordered items + caller's progress. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    return NextResponse.json(await getCourse(id, ctx.user.id));
  } catch (err) {
    return engineError(err);
  }
}

/** PATCH /api/training/courses/:id — edit / publish / reorder items (author only). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ title?: string; description?: string; published?: boolean; itemorder?: string[] }>(req);
  try {
    const course = await updateCourse(id, ctx.user.id, body ?? {});
    return NextResponse.json({ course });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/training/courses/:id — remove a course (author only). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    await deleteCourse(id, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
