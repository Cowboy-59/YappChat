import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIpFrom } from "../auth/audit";
import { rateLimit } from "../auth/ratelimit";
import { getConsumerDeps, type ConsumerDeps } from "./deps";
import { ConsumerError } from "./errors";
import { verifyConsumerSecret } from "./wxkanban";

/**
 * SPEC-093 FR-001 / FR-007 — the one guard every /api/consumer/{accounts,groups,
 * rooms} route runs through:
 *
 *  1. `Authorization: Bearer <WXKANBAN_CONSUMER_SECRET>`, compared in constant time
 *     (verifyConsumerSecret, fail closed). Missing or wrong → 401, nothing changes.
 *     No cookie is read, so a browser session can never call these routes.
 *  2. A per-secret rate limit (keyed by a hash of the secret, never the secret).
 *  3. The handler, then exactly ONE authauditlog row for the call: endpoint, target
 *     ids, HTTP status, result code and duration. The secret is never written.
 */

// [SCOPE 093 / T001] BEGIN — Consumer guard constants
/** Calls per minute per secret. A 50-person company sync is well under 200. */
const DEFAULT_RATE_LIMIT = 600;
const RATE_WINDOW_MS = 60_000;

export type ConsumerResult = {
  body: Record<string, unknown>;
  /** Extra target ids learned while handling (e.g. the resolved userid). */
  targets?: Record<string, string | null | undefined>;
  /** The user the audit row is filed under (authauditlog.userid). */
  auditUserid?: string | null;
};
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — Bearer secret extraction
export function bearerSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !/^bearer\s+/i.test(auth)) return null;
  const value = auth.replace(/^bearer\s+/i, "").trim();
  return value.length > 0 ? value : null;
}
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — Rate-limit key and limit
function rateKey(secret: string): string {
  return `consumer:${createHash("sha256").update(secret).digest("hex").slice(0, 24)}`;
}

function rateLimitPerMinute(): number {
  const raw = Number(process.env.WXKANBAN_CONSUMER_RATE_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RATE_LIMIT;
}
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — Map a thrown error to a consumer response
function errorStatus(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof ConsumerError) {
    return { status: err.status, body: { error: err.code, ...err.extra } };
  }
  // AuthError / EngineError from the reused services carry { code, status }.
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: unknown; status?: unknown };
    if (typeof e.code === "string" && typeof e.status === "number" && e.status >= 400 && e.status < 600) {
      return { status: e.status, body: { error: e.code } };
    }
  }
  return { status: 500, body: { error: "internal_error" } };
}
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — consumerCall guard
export async function consumerCall(
  req: Request,
  endpoint: string,
  targets: Record<string, string | null | undefined>,
  handler: (deps: ConsumerDeps) => Promise<ConsumerResult>,
): Promise<NextResponse> {
  const started = Date.now();
  const deps = await getConsumerDeps();
  const ip = clientIpFrom(req);

  const finish = async (
    status: number,
    body: Record<string, unknown>,
    extra?: { targets?: Record<string, string | null | undefined>; auditUserid?: string | null },
    headers?: Record<string, string>,
  ): Promise<NextResponse> => {
    const allTargets: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...targets, ...(extra?.targets ?? {}) })) {
      if (typeof v === "string" && v.length > 0) allTargets[k] = v;
    }
    await deps.store.writeAudit({
      userid: extra?.auditUserid ?? null,
      ip,
      payload: {
        via: "wxkanban_consumer",
        endpoint,
        status,
        result: typeof body.error === "string" ? body.error : "ok",
        targets: allTargets,
        durationms: Date.now() - started,
      },
    });
    return NextResponse.json(body, { status, headers });
  };

  const secret = bearerSecret(req);
  if (!secret || !verifyConsumerSecret(secret)) {
    return finish(401, { error: "unauthorized" });
  }

  const rate = rateLimit(rateKey(secret), rateLimitPerMinute(), RATE_WINDOW_MS);
  if (!rate.allowed) {
    return finish(429, { error: "rate_limited" }, undefined, { "retry-after": String(rate.retryAfterSec) });
  }

  try {
    const result = await handler(deps);
    return finish(200, result.body, { targets: result.targets, auditUserid: result.auditUserid });
  } catch (err) {
    const { status, body } = errorStatus(err);
    return finish(status, body);
  }
}
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — JSON body reader
/** Parse a JSON object body; anything else (absent, invalid, an array) is null. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
// [SCOPE 093 / T001] END
