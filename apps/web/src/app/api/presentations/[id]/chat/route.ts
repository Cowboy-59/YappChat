import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { sendChat } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

const ChatSchema = z.object({
  text: z.string().min(1).max(2000),
  guestname: z.string().trim().min(1).max(80).optional(),
});

/** POST /api/presentations/:id/chat — send an in-session chat message. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const parsed = ChatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  const name = user?.displayname ?? parsed.data.guestname ?? "Guest";
  try {
    await sendChat(id, { userid: user?.id ?? null, name }, parsed.data.text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
