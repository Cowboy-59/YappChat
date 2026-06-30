import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { skilltestlogs } from "../db/studio-schema";
import { StudioError } from "./errors";
import { validateInput } from "./skill-schema";
import { getSkillWithToken } from "./skills";

/**
 * Spec 004 T002 — skill handler test console.
 * Validates input against the skill's schema, POSTs to the handler URL with the
 * X-Skill-Token header, records the exchange in skilltestlogs, and returns the
 * full request/response regardless of success.
 */
const TEST_TIMEOUT_MS = 30_000;

export type TestResult = {
  status: number | null;
  latencyms: number;
  responseBody: unknown;
  requestSent: unknown;
  success: boolean;
  error?: string;
};

export async function runSkillTest(
  orgid: string,
  userid: string,
  skillid: string,
  input: unknown,
): Promise<TestResult> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);

  const skill = await getSkillWithToken(orgid, skillid);
  if (!skill.handlerurl) throw new StudioError("handler_url_not_set", 422);

  // Validate inputs against the current schema BEFORE calling the handler.
  const check = validateInput(skill.inputschema, input);
  if (!check.valid) throw new StudioError("input_validation_failed", 422, check.errors);

  const started = Date.now();
  let result: TestResult;
  try {
    const res = await fetch(skill.handlerurl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-skill-token": skill.skilltoken },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    const latencyms = Date.now() - started;
    const text = await res.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }
    result = {
      status: res.status,
      latencyms,
      responseBody,
      requestSent: input,
      success: res.ok,
    };
  } catch (err) {
    const latencyms = Date.now() - started;
    const isTimeout = (err as Error).name === "TimeoutError";
    result = {
      status: null,
      latencyms,
      responseBody: null,
      requestSent: input,
      success: false,
      error: isTimeout
        ? "Handler timed out after 30s."
        : "Handler URL not reachable — check the URL and that your server is running.",
    };
  }

  await db.insert(skilltestlogs).values({
    id: uuidv7(),
    skillid,
    testedinput: input as object,
    httpstatus: result.status,
    responsebody: (result.responseBody ?? null) as object,
    latencyms: result.latencyms,
    success: result.success,
    testedby: userid,
  });

  return result;
}
