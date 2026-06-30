import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { respondToContact } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** POST /api/contacts/:id/respond { accept } — accept/decline a contact request. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ accept?: boolean }>(req);
  try {
    await respondToContact(id, ctx.user.id, Boolean(body?.accept));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
