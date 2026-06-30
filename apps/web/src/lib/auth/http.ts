import { NextResponse } from "next/server";
import { AuthError } from "./service";

/** Map a thrown AuthError (or unknown) to a JSON response. */
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  console.error("[auth] unexpected error:", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

/** Parse a JSON body, returning null on malformed input. */
export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
