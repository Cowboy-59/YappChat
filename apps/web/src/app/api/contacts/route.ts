import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { listContacts, listIncomingRequests } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** GET /api/contacts — the caller's accepted contacts + incoming pending requests. */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const [contacts, requests] = await Promise.all([listContacts(ctx.user.id), listIncomingRequests(ctx.user.id)]);
  return NextResponse.json({ me: ctx.user.id, contacts, requests });
}
