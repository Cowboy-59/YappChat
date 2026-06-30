import { z } from "zod";
import Ajv from "ajv";

/**
 * Spec 004 T001/T002 — skill validation: Zod for request shape, ajv for the
 * user-authored JSON Schema (Draft 7), and semver helpers for auto-versioning.
 */

export const SKILL_CATEGORIES = [
  "productivity",
  "communication",
  "data",
  "development",
  "finance",
  "media",
  "integration",
  "custom",
] as const;

const skillName = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, "snake_case, 1–64 chars, starting with a letter");

export const skillCreateSchema = z.object({
  name: skillName,
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  category: z.enum(SKILL_CATEGORIES).default("custom"),
  inputschema: z.record(z.string(), z.unknown()).default({ type: "object", properties: {} }),
  handlerurl: z.string().default(""),
  async: z.boolean().default(false),
});

export const skillUpdateSchema = z
  .object({
    label: z.string().min(1).max(120),
    description: z.string().min(1).max(2000),
    category: z.enum(SKILL_CATEGORIES),
    inputschema: z.record(z.string(), z.unknown()),
    handlerurl: z.string(),
    async: z.boolean(),
    versionbump: z.enum(["patch", "minor", "major"]),
  })
  .partial();

export type SkillCreate = z.infer<typeof skillCreateSchema>;
export type SkillUpdate = z.infer<typeof skillUpdateSchema>;

const ajv = new Ajv({ allErrors: true, strict: false });

/** Validate that an object is itself a usable JSON Schema (Draft 7). */
export function validateJsonSchema(schema: unknown): { valid: boolean; error?: string } {
  if (typeof schema !== "object" || schema === null) {
    return { valid: false, error: "Schema must be an object." };
  }
  try {
    ajv.compile(schema as object);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: plainAjvError((err as Error).message) };
  }
}

/** Validate concrete input data against a skill's inputschema. */
export function validateInput(
  schema: unknown,
  data: unknown,
): { valid: boolean; errors: string[] } {
  try {
    const validate = ajv.compile(schema as object);
    const valid = validate(data);
    if (valid) return { valid: true, errors: [] };
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`.trim(),
    );
    return { valid: false, errors };
  } catch {
    return { valid: false, errors: ["The skill's input schema is invalid."] };
  }
}

function plainAjvError(raw: string): string {
  // Surface a friendlier message than raw ajv internals.
  return raw.replace(/^schema is invalid:\s*/i, "Invalid JSON Schema: ");
}

export type VersionBump = "patch" | "minor" | "major";

export function bumpVersion(current: string, type: VersionBump): string {
  const parts = current.split(".").map((n) => parseInt(n, 10));
  let [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}
