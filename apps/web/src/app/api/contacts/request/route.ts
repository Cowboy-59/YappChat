import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { inviteContactByEmail, requestContact } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/request — ask to connect.
 *  { addresseeid } → request an existing user (also used by "click a person in a
 *    community"). { email } → request if they exist, else email-invite them to join.
 */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ addresseeid?: string; email?: string }>(req);
  try {
    if (body?.addresseeid) {
      const r = await requestContact(ctx.user.id, body.addresseeid);
      return NextResponse.json({ ok: true, mode: "requested", ...r });
    }
    if (body?.email?.trim()) {
      const r = await inviteContactByEmail(ctx.user.id, body.email);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ error: "addressee_or_email_required" }, { status: 400 });
  } catch (err) {
    return engineError(err);
  }
}
