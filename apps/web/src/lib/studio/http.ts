import { NextResponse } from "next/server";
import { requireAuth, type OrgSummary, type SessionUser } from "../auth/session";
import { StudioError } from "./errors";

/**
 * Spec 004 — studio route helpers. Every studio API is authenticated and
 * org-scoped (the caller must belong to an org).
 */
export type StudioCtx =
  | { ok: true; user: SessionUser; org: OrgSummary }
  | { ok: false; response: NextResponse };

export async function studioContext(): Promise<StudioCtx> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return { ok: false, response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  if (!auth.org) {
    return { ok: false, response: NextResponse.json({ error: "no_org" }, { status: 403 }) };
  }
  return { ok: true, user: auth.user, org: auth.org };
}

export function studioError(err: unknown): NextResponse {
  if (err instanceof StudioError) {
    return NextResponse.json({ error: err.code, details: err.details }, { status: err.status });
  }
  console.error("[studio] unexpected error:", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
