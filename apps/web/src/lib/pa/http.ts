import { NextResponse } from "next/server";
import { requireAuth, type SessionUser } from "../auth/session";
import { PaError } from "./errors";

export type PaCtx =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export async function paContext(): Promise<PaCtx> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return { ok: false, response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { ok: true, user: auth.user };
}

export function paError(err: unknown): NextResponse {
  if (err instanceof PaError) {
    return NextResponse.json({ error: err.code, detail: err.detail }, { status: err.status });
  }
  console.error("[pa] unexpected error:", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
