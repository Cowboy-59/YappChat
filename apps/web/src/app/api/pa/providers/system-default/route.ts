import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { paError, readJson } from "@/lib/pa/http";
import { setSystemDefault } from "@/lib/pa/providers";

export const dynamic = "force-dynamic";

/** PATCH /api/pa/providers/system-default — set/clear the system default (issystemadmin only). */
export async function PATCH(req: Request) {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await readJson<{ providerid?: string | null }>(req);
  try {
    await setSystemDefault(body?.providerid ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return paError(err);
  }
}
