import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { listContacts, listIncomingRequests, listOutgoing } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** GET /api/contacts — accepted contacts + incoming pending requests + outgoing pending (FR-008). */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const [contacts, requests, outgoing] = await Promise.all([
    listContacts(ctx.user.id),
    listIncomingRequests(ctx.user.id),
    listOutgoing(ctx.user.id),
  ]);
  return NextResponse.json({ me: ctx.user.id, contacts, requests, outgoing });
}
