import { NextResponse } from "next/server";
import { requireAuth, type SessionUser } from "../auth/session";
import { EngineError } from "./errors";

export type EngineCtx =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export async function engineContext(): Promise<EngineCtx> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return { ok: false, response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { ok: true, user: auth.user };
}

export function engineError(err: unknown): NextResponse {
  if (err instanceof EngineError) {
    return NextResponse.json({ error: err.code, detail: err.detail }, { status: err.status });
  }
  console.error("[engine] unexpected error:", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
