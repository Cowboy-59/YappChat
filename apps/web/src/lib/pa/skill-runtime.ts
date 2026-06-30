import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { skills } from "../db/studio-schema";
import { skillinvocations } from "../db/pa-schema";
import { validateInput } from "../studio/skill-schema";
import type { ToolDef } from "./adapters";

/**
 * Spec 002 T006 — skill invocation runtime (FR-014).
 * Resolves enabled Studio (004) skills as tools, validates tool-use arguments,
 * calls the handler over HTTPS with X-Skill-Token, retries transient failures,
 * caps per-user concurrency, and logs every invocation to skillinvocations.
 * Async skills run inline in this slice (subagent runtime FR-015 deferred).
 */
type SkillRow = typeof skills.$inferSelect;

const HANDLER_TIMEOUT_MS = 30_000;
const MAX_CONCURRENCY = 5;
const inflight = new Map<string, number>();

export async function buildSkillTools(
  orgid: string,
): Promise<{ tools: ToolDef[]; byName: Map<string, SkillRow> }> {
  const db = getDb();
  if (!db) return { tools: [], byName: new Map() };
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.orgid, orgid), eq(skills.enabled, true)));

  const byName = new Map<string, SkillRow>();
  const tools: ToolDef[] = [];
  for (const s of rows) {
    byName.set(s.name, s);
    tools.push({
      name: s.name,
      description: s.description,
      parameters: (s.inputschema as Record<string, unknown>) ?? { type: "object", properties: {} },
    });
  }
  return { tools, byName };
}

export type SkillResult = { content: string; success: boolean };

export async function executeSkill(
  skill: SkillRow,
  args: unknown,
  ctx: { userid: string; sessionid?: string | null; invokedby?: "pa" | "subagent" | "studio_test" },
): Promise<SkillResult> {
  // Disabled skills are never invoked.
  if (!skill.enabled) {
    return { content: JSON.stringify({ ok: false, error: "skill_disabled" }), success: false };
  }
  // Validate arguments against the skill's schema; let the model correct itself.
  const check = validateInput(skill.inputschema, args);
  if (!check.valid) {
    return {
      content: JSON.stringify({ ok: false, error: "input_validation_failed", details: check.errors }),
      success: false,
    };
  }
  if (!skill.handlerurl) {
    return { content: JSON.stringify({ ok: false, error: "handler_url_not_set" }), success: false };
  }
  const allowHttp = process.env.ALLOW_HTTP_SKILL_HANDLERS === "true";
  if (!skill.handlerurl.startsWith("https://") && !(allowHttp && skill.handlerurl.startsWith("http://"))) {
    return { content: JSON.stringify({ ok: false, error: "insecure_handler_url" }), success: false };
  }

  // Per-user concurrency cap (queue up to 10s, then skill_busy).
  const slot = await acquire(ctx.userid);
  if (!slot) {
    return { content: JSON.stringify({ ok: false, error: "skill_busy" }), success: false };
  }

  const started = Date.now();
  let httpstatus: number | null = null;
  let responseBody: unknown = null;
  let errormessage: string | null = null;
  let success = false;

  try {
    const { status, body, error } = await callHandlerWithRetry(skill, args);
    httpstatus = status;
    responseBody = body;
    errormessage = error;
    success = status != null && status >= 200 && status < 300;
  } finally {
    release(ctx.userid);
  }

  const latencyms = Date.now() - started;
  await logInvocation({
    skillid: skill.id,
    userid: ctx.userid,
    sessionid: ctx.sessionid ?? null,
    invokedby: ctx.invokedby ?? "pa",
    args,
    httpstatus,
    responseBody,
    errormessage,
    latencyms,
    success,
  });

  if (!success) {
    return {
      content: JSON.stringify({ ok: false, error: errormessage ?? `http_${httpstatus}`, body: responseBody }),
      success: false,
    };
  }
  return { content: typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody), success: true };
}

async function callHandlerWithRetry(
  skill: SkillRow,
  args: unknown,
): Promise<{ status: number | null; body: unknown; error: string | null }> {
  const backoffs = [1000, 3000];
  let attempt = 0;
  for (;;) {
    try {
      const res = await fetch(skill.handlerurl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-skill-token": skill.skilltoken,
          "user-agent": "yappchat-pa/0.1",
        },
        body: JSON.stringify(args ?? {}),
        signal: AbortSignal.timeout(HANDLER_TIMEOUT_MS),
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 32_000);
      }
      // Retry 5xx; do NOT retry 4xx.
      if (res.status >= 500 && attempt < backoffs.length) {
        await sleep(backoffs[attempt++]);
        continue;
      }
      return { status: res.status, body, error: null };
    } catch (err) {
      // Network/timeout — retry with backoff.
      if (attempt < backoffs.length) {
        await sleep(backoffs[attempt++]);
        continue;
      }
      return { status: null, body: null, error: (err as Error).message };
    }
  }
}

async function logInvocation(p: {
  skillid: string;
  userid: string;
  sessionid: string | null;
  invokedby: "pa" | "subagent" | "studio_test";
  args: unknown;
  httpstatus: number | null;
  responseBody: unknown;
  errormessage: string | null;
  latencyms: number;
  success: boolean;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(skillinvocations).values({
      id: uuidv7(),
      skillid: p.skillid,
      userid: p.userid,
      sessionid: p.sessionid,
      invokedby: p.invokedby,
      arguments: p.args as object,
      httpstatus: p.httpstatus,
      responsebody: truncate(p.responseBody),
      errormessage: p.errormessage,
      latencyms: p.latencyms,
      success: p.success,
    });
  } catch (err) {
    console.error("[pa] skillinvocation log failed:", err);
  }
}

function truncate(body: unknown): unknown {
  const s = JSON.stringify(body ?? null);
  if (s.length <= 32_000) return body;
  return { truncated: true, preview: s.slice(0, 32_000) };
}

async function acquire(userid: string): Promise<boolean> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const n = inflight.get(userid) ?? 0;
    if (n < MAX_CONCURRENCY) {
      inflight.set(userid, n + 1);
      return true;
    }
    if (Date.now() >= deadline) return false;
    await sleep(200);
  }
}

function release(userid: string): void {
  const n = inflight.get(userid) ?? 1;
  if (n <= 1) inflight.delete(userid);
  else inflight.set(userid, n - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
